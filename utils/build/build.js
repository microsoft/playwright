/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const child_process = require('child_process');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');
const { workspace } = require('../workspace');
const { build, context } = require('esbuild');

/**
 * @typedef {{
 *   files: string,
 *   from: string,
 *   to: string,
 *   ignored?: string[],
 * }} CopyFile
 */

/**
 * @typedef {{
 *   inputs: string[],
 *   mustExist?: string[],
 *   cwd?: string,
 * }} BaseOnChange
 */

/**
 * @typedef {BaseOnChange & {
 *   command: string,
 *   args?: string[],
 * }} CommandOnChange
 */

/**
 * @typedef {BaseOnChange & {
 *   script: string,
 * }} ScriptOnChange
 */

/**
 * @typedef {CommandOnChange|ScriptOnChange} OnChange
 */

/** @type {(() => void)[]} */
const disposables = [];
/** @type {Step[]} */
const steps = [];
/** @type {OnChange[]} */
const onChanges = [];
/** @type {CopyFile[]} */
const copyFiles = [];

const watchMode = process.argv.slice(2).includes('--watch');
const withSourceMaps = watchMode;
const disableInstall = process.argv.slice(2).includes('--disable-install');
const ROOT = path.join(__dirname, '..', '..');

/**
 * @param {string} relative
 * @returns {string}
 */
function filePath(relative) {
  return path.join(ROOT, ...relative.split('/'));
}

/**
 * @param {string} path
 * @returns {string}
 */
function quotePath(path) {
  return "\"" + path + "\"";
}

class Step {
  /**
   * @param {{
   *   concurrent?: boolean,
   * }} options
   */
  constructor(options) {
    this.concurrent = options.concurrent;
  }

  async run() {
    throw new Error('Not implemented');
  }
}

class ProgramStep extends Step {
  /**
   * @param {{
   *   command: string,
   *   args: string[],
   *   shell: boolean,
   *   env?: NodeJS.ProcessEnv,
   *   cwd?: string,
   *   concurrent?: boolean,
   * }} options
   */
  constructor(options) {
    super(options);
    this._options = options;
  }

  /** @override */
  async run() {
    const step = this._options;
    console.log(`==== Running ${step.command} ${step.args.join(' ')} in ${step.cwd || process.cwd()}`);
    const child = child_process.spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: step.shell,
      env: {
        ...process.env,
        ...step.env
      },
      cwd: step.cwd,
    });
    disposables.push(() => {
      if (child.exitCode === null)
        child.kill();
    });
    return new Promise((resolve, reject) => {
      child.on('close', (code, signal) => {
        if (code || signal)
          reject(new Error(`'${step.command} ${step.args.join(' ')}' exited with code ${code}, signal ${signal}`));
        else
          resolve({ });
      });
    });
  }
}

/**
 * @param {OnChange} onChange
 */
async function runOnChangeStep(onChange) {
  const step = ('script' in onChange)
    ? new ProgramStep({ command: 'node', args: [filePath(onChange.script)], shell: false })
    : new ProgramStep({ command: onChange.command, args: onChange.args || [], shell: true, cwd: onChange.cwd });
  await step.run();
}

async function runWatch() {
  /** @param {OnChange} onChange */
  function runOnChange(onChange) {
    const paths = onChange.inputs;
    const mustExist = onChange.mustExist || [];
    let timeout;
    function callback() {
      timeout = undefined;
      for (const fileMustExist of mustExist) {
        if (!fs.existsSync(filePath(fileMustExist)))
          return;
      }
      runOnChangeStep(onChange).catch(e => console.error(e));
    }
    // chokidar will report all files as added in a sync loop, throttle those.
    const reschedule = () => {
      if (timeout)
        clearTimeout(timeout);
      timeout = setTimeout(callback, 500);
    };
    chokidar.watch([...paths, ...mustExist, onChange.script].filter(Boolean).map(filePath)).on('all', reschedule);
    callback();
  }

  for (const { files, from, to, ignored } of copyFiles) {
    const watcher = chokidar.watch([filePath(files)], { ignored });
    watcher.on('all', (event, file) => {
      copyFile(file, from, to);
    });
  }

  for (const step of steps) {
    if (!step.concurrent)
      await step.run();
  }

  for (const step of steps) {
    if (step.concurrent)
      step.run().catch(e => console.error(e));
  }
  for (const onChange of onChanges)
    runOnChange(onChange);
}

async function runBuild() {
  for (const { files, from, to, ignored } of copyFiles) {
    const watcher = chokidar.watch([filePath(files)], {
      ignored
    });
    watcher.on('add', file => {
      copyFile(file, from, to);
    });
    await new Promise(x => watcher.once('ready', x));
    watcher.close();
  }
  for (const step of steps)
    await step.run();
  for (const onChange of onChanges)
    runOnChangeStep(onChange);
}

/**
 * @param {string} file
 * @param {string} from
 * @param {string} to
 */
function copyFile(file, from, to) {
  const destination = path.resolve(filePath(to), path.relative(filePath(from), file));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

class GroupStep extends Step {
  /** @param {Step[]} steps */
  constructor(steps) {
    super({ concurrent: false });
    this._steps = steps;
    if (steps.some(s => !s.concurrent))
      throw new Error('Composite step cannot contain non-concurrent steps');
  }
  async run() {
    console.log('==== Starting parallel group');
    const start = Date.now();
    await Promise.all(this._steps.map(step => step.run()));
    console.log('==== Parallel group finished in', Date.now() - start, 'ms');
  }
}

/** @type {Step[]} */
const updateSteps = [];

// Update test runner.
updateSteps.push(new ProgramStep({
  command: 'npm',
  args: ['ci', '--save=false', '--fund=false', '--audit=false'],
  shell: true,
  cwd: path.join(__dirname, '..', '..', 'tests', 'playwright-test', 'stable-test-runner'),
  concurrent: true,
}));


steps.push(new GroupStep(updateSteps));

// Build injected icons.
steps.push(new ProgramStep({
  command: 'node',
  args: ['utils/generate_clip_paths.js'],
  shell: true,
}));

// Build injected scripts.
steps.push(new ProgramStep({
  command: 'node',
  args: ['utils/generate_injected.js'],
  shell: true,
}));

class EsbuildStep extends Step {
  /** @type {import('esbuild').BuildOptions} */
  constructor(options, watchPaths = []) {
    // Starting esbuild steps in parallel showed longer overall time.
    super({ concurrent: false });
    options = {
      sourcemap: withSourceMaps ? 'linked' : false,
      platform: 'node',
      format: 'cjs',
      ...options,
    };
    this._watchPaths = watchPaths;
    if (options.bundle) {
      // For bundled outputs we always want a metafile so we can emit a
      // sidecar report next to each output.
      if (!options.metafile)
        options.metafile = true;
      // Suppress direct-eval warnings — Playwright intentionally uses eval
      // in evaluate() callbacks that get stringified and sent to the browser.
      if (!options.logOverride)
        options.logOverride = {};
      if (!options.logOverride['direct-eval'])
        options.logOverride['direct-eval'] = 'silent';
    }
    this._options = options;
  }

  /** @override */
  async run() {
    if (watchMode) {
      await this._ensureWatching();
    } else {
      console.log('==== Running esbuild:', this._relativeEntryPoints().join(', '));
      const start = Date.now();
      const result = await build(this._options);
      await this._writeBundleReport(result);
      console.log('==== Done in', Date.now() - start, 'ms');
    }
  }

  async _ensureWatching() {
    const start = Date.now();
    if (this._context)
      return;
    this._context = await context(this._options);
    disposables.push(() => this._context?.dispose());

    const watcher = chokidar.watch([...this._options.entryPoints, ...(this._watchPaths || [])]);
    await new Promise(x => watcher.once('ready', x));
    watcher.on('all', () => this._rebuild());

    await this._rebuild();
    console.log('==== Esbuild watching:', this._relativeEntryPoints().join(', '), `(started in ${Date.now() - start}ms)`);
  }

  async _rebuild() {
    if (this._rebuilding) {
      this._sourcesChanged = true;
      return;
    }
    do {
      this._sourcesChanged = false;
      this._rebuilding = true;
      try {
        const result = await this._context?.rebuild();
        if (result)
          await this._writeBundleReport(result);
      } catch (e) {
        // Ignore. Esbuild inherits stderr and already logs nicely formatted errors
        // before throwing.
      }

      this._rebuilding = false;
    } while (this._sourcesChanged);
  }

  /**
   * @param {import('esbuild').BuildResult} result
   */
  async _writeBundleReport(result) {
    if (!this._options.bundle || !result.metafile)
      return;
    await require('./bundle_report').writeReports(result);
  }

  _relativeEntryPoints() {
    return this._options.entryPoints.map(e => path.relative(ROOT, e));
  }
}

class CustomCallbackStep extends Step {
  constructor(callback) {
    super({ concurrent: false });
    this._callback = callback;
  }

  async run() {
    await this._callback();
  }
}

// Single onLoad plugin that does two source-level rewrites:
//
// 1. `await import('./rel')` → `require('./rel')`. esbuild preserves dynamic
//    import() even in CJS format; we want local imports to use require()
//    uniformly.
//
// 2. `import { X } from '@isomorphic/foo'` / `'@utils/bar'` →
//    `const { X } = require('playwright-core/lib/coreBundle').iso`
//    (same for serverUtils). Per-file esbuild (bundle:false) can't follow
//    path aliases to files outside the emitted tree, so we translate these
//    at source-load time into coreBundle namespace access. Bundled outputs
//    (transform/) use esbuild's `alias` option instead.
//
// Both rewrites must live in the SAME plugin because esbuild only runs one
// onLoad handler per file; the first plugin that returns contents wins.
//
// 3. `import …  from '<vendored-pkg>'` (debug, mime, ws, …) →
//    `const … = require('playwright-core/lib/utilsBundle').<key>` so that
//    consumers can write idiomatic npm imports while the runtime still goes
//    through the vendored utilsBundle. The mapping lives in
//    utils/build/utilsBundleMapping.js.
const { MAPPING: VENDORED_MAPPING, VENDORED_PACKAGES } = require('./utilsBundleMapping');

const VENDORED_INVERSE_NAMED = {};
for (const [pkg, def] of Object.entries(VENDORED_MAPPING)) {
  VENDORED_INVERSE_NAMED[pkg] = {};
  if (def.named) {
    for (const [srcName, key] of Object.entries(def.named))
      VENDORED_INVERSE_NAMED[pkg][srcName] = key;
  }
}

const VENDORED_PKG_RE = new RegExp(
    '^import\\s+(' +
    '\\{[^}]*\\}|' +
    '\\*\\s+as\\s+\\w+|' +
    '\\w+(?:\\s*,\\s*\\{[^}]*\\})?' +
    ')\\s+from\\s+\'(' +
    [...VENDORED_PACKAGES].map(p => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|') +
    ')\';?',
    'gm'
);

function _utilsBundleSpecifier(filePath) {
  const coreSrcMarker = `${path.sep}playwright-core${path.sep}src${path.sep}`;
  const idx = filePath.indexOf(coreSrcMarker);
  if (idx === -1)
    return "'playwright-core/lib/utilsBundle'";
  const coreSrcRoot = filePath.slice(0, idx + coreSrcMarker.length - 1);
  let rel = path.relative(path.dirname(filePath), path.join(coreSrcRoot, 'utilsBundle'));
  rel = rel.split(path.sep).join('/');
  if (!rel.startsWith('.'))
    rel = './' + rel;
  return `'${rel}'`;
}

function _parseClause(clause) {
  // Returns { default?: name, namespace?: name, named?: [{src, alias}] }
  const out = {};
  if (clause.startsWith('{')) {
    out.named = _parseNamedList(clause);
    return out;
  }
  if (clause.startsWith('*')) {
    out.namespace = clause.match(/\*\s+as\s+(\w+)/)[1];
    return out;
  }
  // default or "default, { named }"
  const m = clause.match(/^(\w+)(?:\s*,\s*(\{[^}]*\}))?$/);
  if (!m)
    return null;
  out.default = m[1];
  if (m[2])
    out.named = _parseNamedList(m[2]);
  return out;
}

function _parseNamedList(braced) {
  const inner = braced.replace(/^\s*\{|\}\s*$/g, '').trim();
  if (!inner)
    return [];
  return inner
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      // Strip `type` modifier on individual specifiers — type-only imports
      // don't need runtime rewriting, but they're often mixed with value
      // imports inside a single `{ ... }` clause.
      .map(s => s.replace(/^type\s+/, ''))
      .map(spec => {
        const m = spec.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
        if (!m)
          return null;
        return { src: m[1], alias: m[2] || m[1] };
      })
      .filter(Boolean);
}

function _rewriteVendoredImports(filePath, contents) {
  const bundleSpec = _utilsBundleSpecifier(filePath);
  return contents.replace(VENDORED_PKG_RE, (full, clause, pkg) => {
    const def = VENDORED_MAPPING[pkg];
    const parsed = _parseClause(clause);
    if (!parsed)
      return full;
    /** @type {string[]} */
    const lines = [];
    if (parsed.default && def.default)
      lines.push(`const ${parsed.default} = require(${bundleSpec}).${def.default};`);
    if (parsed.namespace && def.namespace)
      lines.push(`const ${parsed.namespace} = require(${bundleSpec}).${def.namespace};`);
    if (parsed.named && def.named) {
      const renames = parsed.named.map(({ src, alias }) => {
        const key = def.named[src];
        if (!key)
          return null;
        return key === alias ? key : `${key}: ${alias}`;
      }).filter(Boolean);
      if (renames.length)
        lines.push(`const { ${renames.join(', ')} } = require(${bundleSpec});`);
    }
    return lines.length ? lines.join('\n') : full;
  });
}

const dynamicImportToRequirePlugin = {
  name: 'dynamic-import-to-require',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');
      const isPlaywrightSrc = args.path.includes(`${path.sep}playwright${path.sep}src${path.sep}`);
      const hasAlias = isPlaywrightSrc && (contents.includes("'@isomorphic/") || contents.includes("'@utils/"));
      let hasVendored = false;
      for (const pkg of VENDORED_PACKAGES) {
        if (contents.includes(`'${pkg}'`)) { hasVendored = true; break; }
      }
      if (!hasAlias && !hasVendored)
        return undefined;
      // Run vendored rewrites FIRST so that mappings for specific
      // `@utils/third_party/*` paths win over the generic `@utils/*`
      // alias rewrite below.
      if (hasVendored)
        contents = _rewriteVendoredImports(args.path, contents);
      if (hasAlias) {
        contents = contents.replace(
            /import\s*\{([^}]*)\}\s*from\s*'@isomorphic\/[^']+';?/g,
            (_, names) => `const {${names}} = require('playwright-core/lib/coreBundle').iso;`
        );
        contents = contents.replace(
            /import\s*\{([^}]*)\}\s*from\s*'@utils\/[^']+';?/g,
            (_, names) => `const {${names}} = require('playwright-core/lib/coreBundle').utils;`
        );
      }
      return { contents, loader: 'ts' };
    });
  }
};

// Run esbuild.
for (const pkg of workspace.packages()) {
  if (!fs.existsSync(path.join(pkg.path, 'src')))
    continue;
  // playwright-client is built as a bundle.
  if (['@playwright/client'].includes(pkg.name))
    continue;
  if (pkg.name === 'playwright-core' || pkg.name === 'playwright' || pkg.name === '@playwright/electron')
    continue;

  steps.push(new EsbuildStep({
    entryPoints: [path.join(pkg.path, 'src/**/*.ts')],
    outdir: `${path.join(pkg.path, 'lib')}`,
    plugins: [dynamicImportToRequirePlugin],
  }));
}

// playwright-electron/lib/index.js — self-contained bundle that inlines
// @utils/* and @isomorphic/* sources (via tsconfig paths) plus the `node_modules`
// deps. playwright, electron, and the sibling loader.js are resolved at
// runtime.
{
  const electronPkg = filePath('packages/playwright-electron');
  steps.push(new EsbuildStep({
    bundle: true,
    entryPoints: [path.join(electronPkg, 'src/index.ts')],
    outfile: path.join(electronPkg, 'lib/index.js'),
    external: [
      'playwright',
      'playwright/*',
      'electron',
      'electron/*',
      './loader',
    ],
  }, [filePath('packages/utils'), filePath('packages/isomorphic')]));

  // loader.ts is preloaded inside the Electron main process via `-r` and is
  // already self-contained (no @utils/@isomorphic imports). Compile it
  // per-file so the output stays a thin shim.
  steps.push(new EsbuildStep({
    entryPoints: [path.join(electronPkg, 'src/loader.ts')],
    outdir: path.join(electronPkg, 'lib'),
  }));
}

// Build playwright-core exported entry points.
steps.push(new EsbuildStep({
  entryPoints: [
    // Performance analysis tool.
    filePath('packages/playwright-core/src/bootstrap.ts'),

    // Entry points for oop execution.
    filePath('packages/playwright-core/src/entry/cliDaemon.ts'),
    filePath('packages/playwright-core/src/entry/dashboardApp.ts'),
    filePath('packages/playwright-core/src/entry/mcp.ts'),
    filePath('packages/playwright-core/src/entry/oopBrowserDownload.ts'),

    // CLI client tools, should be a separate bundle.
    filePath('packages/playwright-core/src/tools/cli-client/*.ts'),
    filePath('packages/playwright-core/src/package.ts'),
    filePath('packages/playwright-core/src/tools/utils/socketConnection.ts'),
    filePath('packages/playwright-core/src/tools/utils/extension.ts'),
  ],
  outdir: filePath('packages/playwright-core/lib'),
  plugins: [dynamicImportToRequirePlugin],
}));

// playwright-core/lib/serverRegistry.js
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright-core/src/serverRegistry.js')],
  outfile: filePath('packages/playwright-core/lib/serverRegistry.js'),
  external: ['fsevents'],
}, [filePath('packages/playwright-core/src/*')]));

const playwrightCoreSrc = filePath('packages/playwright-core/src');

// playwright-core/lib/utilsBundle.js — bundled npm utilities barrel.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright-core/src/utilsBundle.ts')],
  outfile: filePath('packages/playwright-core/lib/utilsBundle.js'),
  external: ['fsevents', 'express', '@anthropic-ai/sdk'],
  alias: {
    'raw-body': filePath('utils/build/raw-body.ts'),
  },
}, [filePath('packages/playwright-core/src/utilsBundle.ts'), filePath('utils/build/raw-body.ts')]));

// Build playwright-core as a single bundle.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright-core/src/coreBundle.ts')],
  outfile: filePath('packages/playwright-core/lib/coreBundle.js'),
  external: [
    '../../api.json',
    './help.json',
    // TODO: await import plugin is incompatible with esbuild, remove it
    'electron',
    'electron/*',
    'chromium-bidi',
    'chromium-bidi/*',
    'mitt',
  ],
  // HMR: baked-in flag that enables the dashboard Vite dev server in watch
  // builds. In release builds it's `false` and esbuild dead-code-eliminates
  // the whole dev-server branch (including the `import('vite')` call).
  define: {
    __PW_DASHBOARD_HMR__: String(!!watchMode),
  },
  plugins: [{
    name: 'externalize-utilsBundle',
    setup: build => build.onResolve({ filter: /utilsBundle/ },
        () => ({ path: './utilsBundle', external: true })),
  }, dynamicImportToRequirePlugin],
}, [playwrightCoreSrc]));

function assertCoreBundleHasNoNodeModules() {
  const bundlePath = filePath('packages/playwright-core/lib/coreBundle.js');
  const contents = fs.readFileSync(bundlePath, 'utf8');
  const lines = contents.split('\n');
  const offenders = [];
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf('node_modules/');
    if (idx !== -1)
      offenders.push(`  ${bundlePath}:${i + 1}: ${lines[i].slice(Math.max(0, idx - 10), idx + 80)}`);
  }
  if (offenders.length) {
    console.error(`\n==== coreBundle.js contains 'node_modules/' references (${offenders.length} lines) ====`);
    console.error(offenders.slice(0, 20).join('\n'));
    if (offenders.length > 20)
      console.error(`  ... and ${offenders.length - 20} more`);
    console.error('Mark the offending package as external in the coreBundle esbuild config (utils/build/build.js).');
    process.exit(1);
  }
  console.log('==== coreBundle.js: no node_modules/ references');
}

steps.push(new CustomCallbackStep(assertCoreBundleHasNoNodeModules));

// playwright/lib/transform/esmLoader.js — bundled ESM loader registered by
// common/esmLoaderHost.ts via node:module register. Output sits next to
// babelBundle.js so source-relative `./babelBundle` matches the runtime
// sibling external.
{
  const playwrightSrc = filePath('packages/playwright/src');
  steps.push(new EsbuildStep({
    bundle: true,
    entryPoints: [filePath('packages/playwright/src/transform/esmLoader.ts')],
    outfile: filePath('packages/playwright/lib/transform/esmLoader.js'),
    external: [
      'playwright-core',
      'playwright-core/*',
      '../package',
      '../globals',
    ],
    plugins: [],
  }, [playwrightSrc]));
}

// Build playwright entry points (per-file), excluding matchers/* and
// common/* + transform/* — all of those are produced by bundle steps below.
steps.push(new EsbuildStep({
  entryPoints: [
    filePath('packages/playwright/src/*.ts'),
    filePath('packages/playwright/src/agents/**/*.ts'),
    filePath('packages/playwright/src/cli/**/*.ts'),
    filePath('packages/playwright/src/mcp/**/*.ts'),
  ],
  outdir: filePath('packages/playwright/lib'),
  plugins: [dynamicImportToRequirePlugin],
}));

// playwright/lib/transform/babelBundle.js — bundled babel facade.
// Shared by esmLoaderBundle and commonBundle as an external sibling to
// avoid inlining the full babel package graph into each consumer bundle.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/transform/babelBundle.ts')],
  outfile: filePath('packages/playwright/lib/transform/babelBundle.js'),
  external: [
    '../package',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/matchers/expect.js — bundled jest expect facade.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/matchers/expect.ts')],
  outfile: filePath('packages/playwright/lib/matchers/expect.js'),
  external: [
    'playwright-core',
    'playwright-core/*',
    '../globals',
    '../package',
    '../babelBundle',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/common/index.js — bundled common barrel.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/common/index.ts')],
  outfile: filePath('packages/playwright/lib/common/index.js'),
  external: [
    'playwright-core',
    'playwright-core/*',
    'playwright',
    '../globals',
    '../package',
    '../utils',
    '../matchers/expect',
    '../transform/esmLoader.js',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/runner/index.js — bundled runner barrel.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/runner/index.ts')],
  outfile: filePath('packages/playwright/lib/runner/index.js'),
  external: [
    'playwright-core',
    'playwright-core/*',
    '../common',
    '../globals',
    '../package',
    '../util',
    '../matchers/expect',
    '../loader/loaderProcessEntry.js',
    '../worker/workerProcessEntry.js',
    '../transform/babelBundle',
    '../transform/esmLoader',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/isomorphic/index.js — bundled isomorphic barrel.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/isomorphic/index.ts')],
  outfile: filePath('packages/playwright/lib/isomorphic.js'),
  external: [
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/loader/loaderProcessEntry.js — bundled loader process
// entry. Output sits at the same depth as the source so '../X' externals
// resolve to lib/X.js naturally.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/loader/loaderProcessEntry.ts')],
  outfile: filePath('packages/playwright/lib/loader/loaderProcessEntry.js'),
  external: [
    'playwright-core',
    'playwright-core/*',
    '../common',
    '../globals',
    '../package',
    '../util',
    '../transform/esmLoader',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/worker/workerProcessEntry.js — bundled worker process
// entry. Output sits at the same depth as the source so '../X' externals
// resolve to lib/X.js naturally.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/worker/workerProcessEntry.ts')],
  outfile: filePath('packages/playwright/lib/worker/workerProcessEntry.js'),
  external: [
    'playwright-core',
    'playwright-core/*',
    '../common',
    '../globals',
    '../package',
    '../utils',
    '../matchers/expect',
    '../transform/esmLoader',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

function copyXdgOpen() {
  const outdir = filePath('packages/playwright-core/lib');
  if (!fs.existsSync(outdir))
    fs.mkdirSync(outdir, { recursive: true });

  // 'open' package requires 'xdg-open' binary to be present, which does not get bundled by esbuild.
  fs.copyFileSync(filePath('node_modules/open/xdg-open'), path.join(outdir, 'xdg-open'));
  console.log('==== Copied xdg-open to', path.join(outdir, 'xdg-open'));
}

// Copy xdg-open after bundles 'npm ci' has finished.
steps.push(new CustomCallbackStep(copyXdgOpen));

function pkgNameFromPath(p) {
  const i = p.split(path.sep);
  const nm = i.lastIndexOf('node_modules');
  if (nm === -1 || nm + 1 >= i.length) return null;
  const first = i[nm + 1];
  if (first.startsWith('@')) return nm + 2 < i.length ? `${first}/${i[nm + 2]}` : null;
  return first;
}

const pkgSizePlugin = {
  name: 'pkg-size',
  setup(build) {
    build.onEnd(async (result) => {
      if (!result.metafile) return;
      const totals = new Map();
      for (const out of Object.values(result.metafile.outputs)) {
        for (const [inFile, meta] of Object.entries(out.inputs)) {
          const pkg = pkgNameFromPath(inFile);
          if (!pkg) continue;
          totals.set(pkg, (totals.get(pkg) || 0) + (meta.bytesInOutput || 0));
        }
      }
      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const sum = sorted.reduce((s, [, v]) => s + v, 0) || 1;
      console.log('\nPackage contribution to bundle:');
      for (const [pkg, bytes] of sorted.slice(0, 30)) {
        const pct = ((bytes / sum) * 100).toFixed(2);
        console.log(`${pkg.padEnd(30)} ${(bytes / 1024).toFixed(1)} KB  ${pct}%`);
      }
    });
  },
};

// Build/watch trace viewer service worker.
steps.push(new ProgramStep({
  command: 'npx',
  args: [
    'vite',
    '--config',
    'vite.sw.config.ts',
    'build',
    ...(watchMode ? ['--watch', '--minify=false'] : []),
    ...(withSourceMaps ? ['--sourcemap=inline'] : []),
  ],
  shell: true,
  cwd: path.join(__dirname, '..', '..', 'packages', 'trace-viewer'),
  concurrent: true,
}));

// Build/watch web packages.
// HMR: in watch mode the dashboard is served by the embedded Vite dev server
// in dashboardApp.ts, so skip its `vite build --watch` step. Set
// PW_DASHBOARD_STATIC=1 to keep the watch-build for testing the bundled output.
const hmrReplacesDashboardBuild = watchMode && process.env.PW_DASHBOARD_STATIC !== '1';
const webPackages = ['html-reporter', 'recorder', 'trace-viewer', 'dashboard']
    .filter(pkg => !(pkg === 'dashboard' && hmrReplacesDashboardBuild));
for (const webPackage of webPackages) {
  steps.push(new ProgramStep({
    command: 'npx',
    args: [
      'vite',
      'build',
      ...(watchMode ? ['--watch', '--minify=false'] : []),
      ...(withSourceMaps ? ['--sourcemap=inline'] : []),
      '--clearScreen=false',
    ],
    shell: true,
    cwd: path.join(__dirname, '..', '..', 'packages', webPackage),
    concurrent: true,
  }));
}

// Generate CLI help.
onChanges.push({
  inputs: [
    'packages/playwright-core/src/tools/cli-daemon/commands.ts',
    'packages/playwright-core/src/tools/cli-daemon/helpGenerator.ts',
    'utils/generate_cli_help.js',
  ],
  script: 'utils/generate_cli_help.js',
});

// Generate injected.
onChanges.push({
  inputs: [
    'packages/injected/src/**',
    'packages/playwright-core/src/third_party/**',
    'packages/playwright-ct-core/src/injected/**',
    'packages/isomorphic/**',
    'utils/generate_injected_builtins.js',
    'utils/generate_injected.js',
  ],
  script: 'utils/generate_injected.js',
});

// Generate channels.
onChanges.push({
  inputs: [
    'packages/protocol/src/protocol.yml'
  ],
  script: 'utils/generate_channels.js',
});

// Generate types.
onChanges.push({
  inputs: [
    'docs/src/api/',
    'docs/src/test-api/',
    'docs/src/test-reporter-api/',
    'docs/src/electron-api/',
    'utils/generate_types/overrides.d.ts',
    'utils/generate_types/overrides-test.d.ts',
    'utils/generate_types/overrides-testReporter.d.ts',
    'utils/generate_types/overrides-electron.d.ts',
    'utils/generate_types/exported.json',
    'packages/playwright-core/src/server/chromium/protocol.d.ts',
  ],
  mustExist: [
    'packages/playwright-core/lib/server/deviceDescriptorsSource.json',
  ],
  script: 'utils/generate_types/index.js',
});

if (watchMode && !disableInstall) {
  // Keep browser installs up to date.
  onChanges.push({
    inputs: ['packages/playwright-core/browsers.json'],
    command: 'npx',
    args: ['playwright', 'install'],
  });
}

// The recorder and trace viewer have an app_icon.png that needs to be copied.
copyFiles.push({
  files: 'packages/playwright-core/src/server/chromium/*.png',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});

// esbuild doesn't touch JS files, so copy them manually.
// For example: diff_match_patch.js
copyFiles.push({
  files: 'packages/playwright-core/src/**/*.js',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
  ignored: ['**/.eslintrc.js', '**/injected/**/*']
});

// Sometimes we require JSON files that esbuild ignores.
// For example, deviceDescriptorsSource.json
copyFiles.push({
  files: 'packages/playwright-core/src/**/*.json',
  ignored: ['**/injected/**/*'],
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});


copyFiles.push({
  files: 'packages/playwright/src/agents/*.md',
  from: 'packages/playwright/src',
  to: 'packages/playwright/lib',
});

copyFiles.push({
  files: 'packages/playwright/src/agents/*.yml',
  from: 'packages/playwright/src',
  to: 'packages/playwright/lib',
});

copyFiles.push({
  files: 'packages/playwright-core/src/tools/cli-client/skill/**/*.md',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});

copyFiles.push({
  files: 'packages/playwright-core/src/tools/trace/SKILL.md',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});

copyFiles.push({
  files: 'packages/playwright-core/src/tools/dashboard/*.{png,ico}',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});

if (watchMode) {
  // Run TypeScript for type checking.
  steps.push(new ProgramStep({
    command: 'npx',
    args: ['tsc', '-w', '--preserveWatchOutput', '-p', quotePath(filePath('.'))],
    shell: true,
    concurrent: true,
  }));
}

let cleanupCalled = false;
function cleanup() {
  if (cleanupCalled)
    return;
  cleanupCalled = true;
  for (const disposable of disposables) {
    try {
      disposable();
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

watchMode ? runWatch() : runBuild();
