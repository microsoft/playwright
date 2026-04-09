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
const bundleFilterIndex = process.argv.indexOf('--bundle');
const bundleFilter = bundleFilterIndex !== -1 ? process.argv[bundleFilterIndex + 1] : undefined;
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

/**
 * @param {string} filter 
 */
async function runBundleOnly(filter) {
  const matching = bundleSteps.filter((_, i) => bundles[i].modulePath.includes(filter));
  if (!matching.length) {
    console.error(`No bundles matching "${filter}". Available: ${bundles.map(b => b.modulePath).join(', ')}`);
    process.exit(1);
  }
  for (const step of matching)
    await step.run();
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

/**
 * @typedef {{
 *   modulePath: string,
 *   entryPoints: string[],
 *   external?: string[],
 *   outdir?: string,
 *   outfile?: string,
 *   minify?: boolean,
 *   alias?: Record<string, string>,
 * }} BundleOptions
 */

/** @type {BundleOptions[]} */
const bundles = [];

bundles.push({
  modulePath: 'packages/playwright/bundles/babel',
  outdir: 'packages/playwright/lib/transform',
  entryPoints: ['src/babelBundleImpl.ts'],
  external: ['playwright'],
});

bundles.push({
  modulePath: 'packages/playwright/bundles/expect',
  outdir: 'packages/playwright/lib/matchers',
  entryPoints: ['src/expectBundleImpl.ts'],
});

bundles.push({
  modulePath: 'packages/playwright-core/bundles/utils',
  outfile: 'packages/playwright-core/lib/utilsBundleImpl/index.js',
  entryPoints: ['src/utilsBundleImpl.ts'],
  external: ['fsevents', 'express', '@anthropic-ai/sdk'],
  alias: {
    'raw-body': 'raw-body.ts',
  },
});

// @playwright/client
bundles.push({
  modulePath: 'packages/playwright-client',
  outdir: 'packages/playwright-client/lib',
  entryPoints: ['src/index.ts'],
  minify: false,
});

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

// Update bundles.
for (const bundle of bundles) {
  // Do not update @playwright/client, it has not its own deps.
  if (bundle.modulePath === 'packages/playwright-client')
    continue;

  const packageJson = path.join(filePath(bundle.modulePath), 'package.json');
  if (!fs.existsSync(packageJson))
    throw new Error(`${packageJson} does not exist`);
  updateSteps.push(new ProgramStep({
    command: 'npm',
    args: ['ci', '--save=false', '--fund=false', '--audit=false', '--omit=optional'],
    shell: true,
    cwd: filePath(bundle.modulePath),
    concurrent: true,
  }));
}

steps.push(new GroupStep(updateSteps));

// Generate third party licenses for bundles.
steps.push(new ProgramStep({
  command: 'node',
  args: [path.resolve(__dirname, '../generate_third_party_notice.js')],
  shell: true,
}));

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
    this._options = options;
    this._watchPaths = watchPaths;
    // For bundled outputs we always want a metafile so we can emit a
    // sidecar .bundle.txt report next to each output.
    if (options.bundle && !options.metafile)
      options.metafile = true;
  }

  /** @override */
  async run() {
    if (watchMode) {
      await this._ensureWatching();
    } else {
      console.log('==== Running esbuild:', this._relativeEntryPoints().join(', '));
      const start = Date.now();
      const result = await build(this._options);
      this._writeBundleReport(result);
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
          this._writeBundleReport(result);
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
  _writeBundleReport(result) {
    if (!this._options.bundle || !result.metafile)
      return;
    const { outputs } = result.metafile;
    for (const [outFile, outInfo] of Object.entries(outputs)) {
      if (outFile.endsWith('.map'))
        continue;
      const inputs = Object.keys(outInfo.inputs)
          .filter(p => !p.startsWith('(disabled):'))
          .sort();
      const externals = new Set();
      for (const [, meta] of Object.entries(outInfo.inputs)) {
        // imports field is per-input via metafile.inputs, not outputs.
      }
      for (const inFile of inputs) {
        const meta = result.metafile.inputs[inFile];
        if (!meta) continue;
        for (const imp of meta.imports || []) {
          if (!imp.external)
            continue;
          if (imp.path.startsWith('node:'))
            continue;
          if (require('module').isBuiltin?.(imp.path) || require('module').builtinModules.includes(imp.path))
            continue;
          externals.add(imp.path);
        }
      }
      const sortedExternals = [...externals].sort();
      const lines = [];
      lines.push(`# ${path.relative(ROOT, outFile)}`);
      lines.push(`# size: ${(outInfo.bytes / 1024).toFixed(1)} KB`);
      lines.push('');
      lines.push(`## Inlined (${inputs.length})`);
      for (const f of inputs)
        lines.push(`  ${f}`);
      lines.push('');
      lines.push(`## External (${sortedExternals.length})`);
      for (const e of sortedExternals)
        lines.push(`  ${e}`);
      lines.push('');
      const reportPath = outFile + '.txt';
      fs.writeFileSync(reportPath, lines.join('\n'));
      const rel = path.relative(ROOT, outFile);
      console.log(`     bundle: ${rel}  (${inputs.length} files, ${sortedExternals.length} external, ${(outInfo.bytes / 1024).toFixed(1)} KB)`);
    }
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
  return inner.split(',').map(s => s.trim()).filter(Boolean).map(spec => {
    const m = spec.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
    return { src: m[1], alias: m[2] || m[1] };
  });
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
      if (hasVendored)
        contents = _rewriteVendoredImports(args.path, contents);
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
  if (pkg.name === 'playwright-core' || pkg.name === 'playwright')
    continue;

  steps.push(new EsbuildStep({
    entryPoints: [path.join(pkg.path, 'src/**/*.ts')],
    outdir: `${path.join(pkg.path, 'lib')}`,
    sourcemap: withSourceMaps ? 'linked' : false,
    platform: 'node',
    format: 'cjs',
    plugins: [dynamicImportToRequirePlugin],
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
    filePath('packages/playwright-core/src/serverRegistry.ts'),
    filePath('packages/playwright-core/src/tools/utils/socketConnection.ts'),

    // Bundle entry points otherwise inlined in coreBundle, figure this out.
    filePath('packages/playwright-core/src/utilsBundle.ts'),
  ],
  outdir: filePath('packages/playwright-core/lib'),
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  plugins: [dynamicImportToRequirePlugin],
}));

const playwrightCoreSrc = filePath('packages/playwright-core/src');

// Build playwright-core as a single bundle.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright-core/src/coreBundle.ts')],
  outfile: filePath('packages/playwright-core/lib/coreBundle.js'),
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  external: [
    './utilsBundleImpl',
    './utilsBundleImpl/*',
    '../../api.json',
    './help.json',
    // TODO: await import plugin is incompatible with esbuild, remove it
    'electron',
    'electron/*',
    'chromium-bidi',
    'chromium-bidi/*',
    'mitt',
  ],
  plugins: [dynamicImportToRequirePlugin],
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
// common/esmLoaderHost.ts via node:module register. Same externalization
// rules as the worker bundle.
{
  const playwrightSrc = filePath('packages/playwright/src');
  steps.push(new EsbuildStep({
    bundle: true,
    entryPoints: [filePath('packages/playwright/src/transform/esmLoader.ts')],
    outfile: filePath('packages/playwright/lib/esmLoaderBundle.js'),
    sourcemap: withSourceMaps ? 'linked' : false,
    platform: 'node',
    format: 'cjs',
    external: [
      'playwright-core',
      'playwright-core/*',
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
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  plugins: [dynamicImportToRequirePlugin],
}));

// playwright/lib/matchers/expect.js — bundled jest expect facade.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/matchers/expect.ts')],
  outfile: filePath('packages/playwright/lib/matchers/expect.js'),
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  external: [
    'playwright-core',
    'playwright-core/*',
    '../globals',
    '../package',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/common/index.js — bundled common barrel.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/common/index.ts')],
  outfile: filePath('packages/playwright/lib/common/index.js'),
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  external: [
    'playwright-core',
    'playwright-core/*',
    '../globals',
    '../package',
    '../utils',
    '../matchers/expect',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// playwright/lib/runner/index.js — bundled runner barrel.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright/src/runner/index.ts')],
  outfile: filePath('packages/playwright/lib/runner/index.js'),
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
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
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  external: [
    'playwright-core',
    'playwright-core/*',
    '../common',
    '../globals',
    '../package',
    '../util',
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
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  external: [
    'playwright-core',
    'playwright-core/*',
    '../common',
    '../globals',
    '../package',
    '../utils',
    '../matchers/expect',
  ],
  plugins: [dynamicImportToRequirePlugin],
}, [filePath('packages/playwright/src')]));

// Build the Electron preload loader as a standalone CJS file. It runs inside
// the Electron process (via `electron -r loader.js`) and must not depend on
// coreBundle. `electron` is resolved at runtime by the Electron process.
steps.push(new EsbuildStep({
  bundle: true,
  entryPoints: [filePath('packages/playwright-core/src/server/electron/loader.ts')],
  outfile: filePath('packages/playwright-core/lib/server/electron/loader.js'),
  sourcemap: withSourceMaps ? 'linked' : false,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
}, [playwrightCoreSrc]));

function copyXdgOpen() {
  const outdir = filePath('packages/playwright-core/lib/utilsBundleImpl');
  if (!fs.existsSync(outdir))
    fs.mkdirSync(outdir, { recursive: true });

  // 'open' package requires 'xdg-open' binary to be present, which does not get bundled by esbuild.
  fs.copyFileSync(filePath('packages/playwright-core/bundles/utils/node_modules/open/xdg-open'), path.join(outdir, 'xdg-open'));
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

// Build/watch bundles.
/**
 * @param {BundleOptions} bundle
 * @returns {import('esbuild').BuildOptions}
 */
function bundleToEsbuildOptions(bundle) {
  return {
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'ES2019',
    sourcemap: watchMode,
    minify: !watchMode,

    entryPoints: bundle.entryPoints.map(e => path.join(filePath(bundle.modulePath), e)),
    ...(bundle.outdir ? { outdir: filePath(bundle.outdir) } : {}),
    ...(bundle.outfile ? { outfile: filePath(bundle.outfile) } : {}),
    ...(bundle.external ? { external: bundle.external } : {}),
    ...(bundle.minify !== undefined ? { minify: bundle.minify } : {}),
    alias: bundle.alias ? Object.fromEntries(Object.entries(bundle.alias).map(([k, v]) => [k, path.join(filePath(bundle.modulePath), v)])) : undefined,
    metafile: true,
    plugins: [pkgSizePlugin],
  };
}

/** @type {EsbuildStep[]} */
const bundleSteps = bundles.map(b => new EsbuildStep(bundleToEsbuildOptions(b)));
for (const step of bundleSteps)
  steps.push(step);

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
for (const webPackage of ['html-reporter', 'recorder', 'trace-viewer', 'dashboard']) {
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
    'packages/playwright-core/src/utils/isomorphic/**',
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
    'utils/generate_types/overrides.d.ts',
    'utils/generate_types/overrides-test.d.ts',
    'utils/generate_types/overrides-testReporter.d.ts',
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


bundleFilter ? runBundleOnly(bundleFilter) : watchMode ? runWatch() : runBuild();
