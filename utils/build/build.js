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

/**
 * @typedef {{
 *   modulePath: string,
 *   entryPoints: string[],
 *   external?: string[],
 *   outdir?: string,
 *   outfile?: string,
 *   minify?: boolean,
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
  outdir: 'packages/playwright/lib/common',
  entryPoints: ['src/expectBundleImpl.ts'],
});

bundles.push({
  modulePath: 'packages/playwright/bundles/utils',
  outdir: 'packages/playwright/lib',
  entryPoints: ['src/utilsBundleImpl.ts'],
  external: ['fsevents'],
});

bundles.push({
  modulePath: 'packages/playwright-core/bundles/utils',
  outfile: 'packages/playwright-core/lib/utilsBundleImpl/index.js',
  entryPoints: ['src/utilsBundleImpl.ts'],
});

bundles.push({
  modulePath: 'packages/playwright-core/bundles/zip',
  outdir: 'packages/playwright-core/lib',
  entryPoints: ['src/zipBundleImpl.ts'],
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
  constructor(options) {
    // Starting esbuild steps in parallel showed longer overall time.
    super({ concurrent: false });
    this._options = options;
  }

  /** @override */
  async run() {
    if (watchMode) {
      await this._ensureWatching();
    } else {
      console.log('==== Running esbuild:', this._relativeEntryPoints().join(', '));
      const start = Date.now();
      await build(this._options);
      console.log('==== Done in', Date.now() - start, 'ms');
    }
  }

  async _ensureWatching() {
    const start = Date.now();
    if (this._context)
      return;
    this._context = await context(this._options);
    disposables.push(() => this._context?.dispose());

    const watcher = chokidar.watch(this._options.entryPoints);
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
        await this._context?.rebuild();
      } catch (e) {
        // Ignore. Esbuild inherits stderr and already logs nicely formatted errors
        // before throwing.
      }

      this._rebuilding = false;
    } while (this._sourcesChanged);
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

// Run esbuild.
for (const pkg of workspace.packages()) {
  if (!fs.existsSync(path.join(pkg.path, 'src')))
    continue;
  // playwright-client is built as a bundle.
  if (['@playwright/client'].includes(pkg.name))
    continue;

  steps.push(new EsbuildStep({
    entryPoints: [path.join(pkg.path, 'src/**/*.ts')],
    outdir: `${path.join(pkg.path, 'lib')}`,
    sourcemap: withSourceMaps ? 'linked' : false,
    platform: 'node',
    format: 'cjs',
  }));
}

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

// Build/watch bundles.
for (const bundle of bundles) {
  /** @type {import('esbuild').BuildOptions} */
  const options = {
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
  };
  steps.push(new EsbuildStep(options));
}

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
  concurrent: watchMode, // feeds into trace-viewer's `public` directory, so it needs to be finished before trace-viewer build starts
}));

if (watchMode) {
  // the build above outputs into `packages/trace-viewer/public`, where the `vite build` for `packages/trace-viewer` is supposed to pick it up.
  // there's a bug in `vite build --watch` though where the public dir is only copied over initially, but its not watched.
  // to work around this, we run a second watch build of the service worker into the final output.
  // bug: https://github.com/vitejs/vite/issues/18655
  steps.push(new ProgramStep({
    command: 'npx',
    args: [
      'vite', '--config', 'vite.sw.config.ts',
      'build', '--watch', '--minify=false',
      '--outDir', path.join(__dirname, '..', '..', 'packages', 'playwright-core', 'lib', 'vite', 'traceViewer'),
      '--emptyOutDir=false',
      '--clearScreen=false',
    ],
    shell: true,
    cwd: path.join(__dirname, '..', '..', 'packages', 'trace-viewer'),
    concurrent: true
  }));
}

// Build/watch web packages.
for (const webPackage of ['html-reporter', 'recorder', 'trace-viewer']) {
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

// web packages dev server
if (watchMode) {
  steps.push(new ProgramStep({
    command: 'npx',
    args: ['vite', '--port', '44223', '--base', '/trace/', '--clearScreen=false'],
    shell: true,
    cwd: path.join(__dirname, '..', '..', 'packages', 'trace-viewer'),
    concurrent: true,
  }));
  steps.push(new ProgramStep({
    command: 'npx',
    args: ['vite', '--port', '44224', '--clearScreen=false'],
    shell: true,
    cwd: path.join(__dirname, '..', '..', 'packages', 'html-reporter'),
    concurrent: true,
  }));
  steps.push(new ProgramStep({
    command: 'npx',
    args: ['vite', '--port', '44225', '--clearScreen=false'],
    shell: true,
    cwd: path.join(__dirname, '..', '..', 'packages', 'recorder'),
    concurrent: true,
  }));
}

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

if (watchMode) {
  // Run TypeScript for type checking.
  steps.push(new ProgramStep({
    command: 'npx',
    args: ['tsc', ...(watchMode ? ['-w'] : []), '--preserveWatchOutput', '-p', quotePath(filePath('.'))],
    shell: true,
    concurrent: true,
  }));
  for (const webPackage of ['html-reporter', 'recorder', 'trace-viewer']) {
    steps.push(new ProgramStep({
      command: 'npx',
      args: ['tsc', ...(watchMode ? ['-w'] : []), '--preserveWatchOutput', '-p', quotePath(filePath(`packages/${webPackage}`))],
      shell: true,
      concurrent: true,
    }));
  }
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
