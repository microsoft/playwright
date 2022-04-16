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

/**
 * @typedef {{
 *   command: string,
 *   args: string[],
 *   shell: boolean,
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string,
 * }} Step
 */

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
 *   committed: boolean,
 *   inputs: string[],
 *   mustExist?: string[],
 *   script?: string,
 *   command?: string,
 *   args?: string[],
 *   cwd?: string,
 * }} OnChange
 */

/** @type {Step[]} */
const steps = [];
/** @type {OnChange[]} */
const onChanges = [];
/** @type {CopyFile[]} */
const copyFiles = [];

const watchMode = process.argv.slice(2).includes('--watch');
const lintMode = process.argv.slice(2).includes('--lint');
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
      if (onChange.script)
        child_process.spawnSync('node', [onChange.script], { stdio: 'inherit' });
      else
        child_process.spawnSync(onChange.command, onChange.args || [], { stdio: 'inherit', cwd: onChange.cwd, shell: true });
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
  /** @type{import('child_process').ChildProcess[]} */
  const spawns = [];
  for (const step of steps) {
    spawns.push(child_process.spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: step.shell,
      env: {
        ...process.env,
        ...step.env,
      },
      cwd: step.cwd,
    }));
  }
  process.on('exit', () => spawns.forEach(s => s.kill()));
  for (const onChange of onChanges)
    runOnChange(onChange);
}

async function runBuild() {
  /**
   * @param {Step} step
   */
  function runStep(step) {
    const out = child_process.spawnSync(step.command, step.args, {
      stdio: 'inherit',
      shell: step.shell,
      env: {
        ...process.env,
        ...step.env
      },
      cwd: step.cwd,
    });
    if (out.status)
      process.exit(out.status);
  }

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
    runStep(step);
  for (const onChange of onChanges) {
    if (onChange.committed)
      continue;
    if (onChange.script)
      runStep({ command: 'node', args: [filePath(onChange.script)], shell: false });
    else
      runStep({ command: onChange.command, args: onChange.args, shell: true, cwd: onChange.cwd });
  }
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

// Update test runner.
steps.push({
  command: 'npm',
  args: ['ci', '--save=false', '--fund=false', '--audit=false'],
  shell: true,
  cwd: path.join(__dirname, '..', '..', 'tests', 'playwright-test', 'stable-test-runner'),
});

// Build injected scripts.
steps.push({
  command: 'node',
  args: ['utils/generate_injected.js'],
  shell: true,
});

// Run Babel.
for (const pkg of workspace.packages()) {
  if (!fs.existsSync(path.join(pkg.path, 'src')))
    continue;
  steps.push({
    command: 'npx',
    args: [
      'babel',
      ...(watchMode ? ['-w', '--source-maps'] : []),
      '--extensions', '.ts',
      '--out-dir', quotePath(path.join(pkg.path, 'lib')),
      '--ignore', '"packages/playwright-core/src/server/injected/**/*"',
      quotePath(path.join(pkg.path, 'src'))],
    shell: true,
  });
}

// Build bundles.
steps.push({
  command: 'npm',
  args: ['run', watchMode ? 'watch' : 'build'],
  shell: true,
  cwd: path.resolve(__dirname, '../../packages/playwright-core/bundles/zip')
});
steps.push({
  command: 'npm',
  args: ['run', watchMode ? 'watch' : 'build'],
  shell: true,
  cwd: path.resolve(__dirname, '../../packages/playwright-test/bundles/babel')
});
steps.push({
  command: 'npm',
  args: ['run', watchMode ? 'watch' : 'build'],
  shell: true,
  cwd: path.resolve(__dirname, '../../packages/playwright-test/bundles/expect')
});

// Generate injected.
onChanges.push({
  committed: false,
  inputs: [
    'packages/playwright-core/src/server/injected/**',
    'utils/generate_injected.js',
  ],
  script: 'utils/generate_injected.js',
});

// Generate channels.
onChanges.push({
  committed: false,
  inputs: [
    'packages/playwright-core/src/protocol/protocol.yml'
  ],
  script: 'utils/generate_channels.js',
});

// Generate types.
onChanges.push({
  committed: false,
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
    'packages/playwright-core/lib/server/deviceDescriptors.js',
    'packages/playwright-core/lib/server/deviceDescriptorsSource.json',
  ],
  script: 'utils/generate_types/index.js',
});

// Rebuild web projects on change.
for (const webPackage of ['html-reporter', 'recorder', 'trace-viewer']) {
  onChanges.push({
    committed: false,
    inputs: [
      `packages/${webPackage}/index.html`,
      `packages/${webPackage}/pubic/`,
      `packages/${webPackage}/src/`,
      `packages/${webPackage}/view.config.ts`,
      `packages/web/src/`,
    ],
    command: 'npx',
    args: ['vite', 'build'],
    cwd: path.join(__dirname, '..', '..', 'packages', webPackage),
  });
}

// The recorder and trace viewer have an app_icon.png that needs to be copied.
copyFiles.push({
  files: 'packages/playwright-core/src/server/chromium/*.png',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});

// Babel doesn't touch JS files, so copy them manually.
// For example: diff_match_patch.js
copyFiles.push({
  files: 'packages/playwright-core/src/**/*.js',
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
  ignored: ['**/.eslintrc.js', '**/webpack*.config.js', '**/injected/**/*']
});

copyFiles.push({
  files: 'packages/playwright-test/src/**/*.js',
  from: 'packages/playwright-test/src',
  to: 'packages/playwright-test/lib',
  ignored: ['**/.eslintrc.js']
});

// Sometimes we require JSON files that babel ignores.
// For example, deviceDescriptorsSource.json
copyFiles.push({
  files: 'packages/playwright-core/src/**/*.json',
  ignored: ['**/injected/**/*'],
  from: 'packages/playwright-core/src',
  to: 'packages/playwright-core/lib',
});

if (lintMode) {
  // Run TypeScript for type checking.
  steps.push({
    command: 'npx',
    args: ['tsc', ...(watchMode ? ['-w'] : []), '-p', quotePath(filePath('.'))],
    shell: true,
  });
  for (const webPackage of ['html-reporter', 'recorder', 'trace-viewer']) {
    steps.push({
      command: 'npx',
      args: ['tsc', ...(watchMode ? ['-w'] : []), '-p', quotePath(filePath(`packages/${webPackage}`))],
      shell: true,
    });  
  }
}

watchMode ? runWatch() : runBuild();
