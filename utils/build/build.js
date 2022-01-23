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
const { packages } = require('../list_packages');

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
 *   script: string,
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

async function runWatch() {
  function runOnChanges(paths, mustExist = [], nodeFile) {
    nodeFile = filePath(nodeFile);
    function callback() {
      for (const fileMustExist of mustExist) {
        if (!fs.existsSync(filePath(fileMustExist)))
          return;
      }
      child_process.spawnSync('node', [nodeFile], { stdio: 'inherit' });
    }
    chokidar.watch([...paths, ...mustExist, nodeFile].map(filePath)).on('all', callback);
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
  for (const step of steps)
    spawns.push(child_process.spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: step.shell,
      env: {
        ...process.env,
        ...step.env,
      },
      cwd: step.cwd,
    }));
  process.on('exit', () => spawns.forEach(s => s.kill()));
  for (const onChange of onChanges)
    runOnChanges(onChange.inputs, onChange.mustExist, onChange.script);
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
    if (!onChange.committed)
      runStep({ command: 'node', args: [filePath(onChange.script)], shell: false });
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
const webPackFiles = [
  'packages/playwright-core/src/server/injected/webpack.config.js',
  'packages/playwright-core/src/web/traceViewer/webpack.config.js',
  'packages/playwright-core/src/web/traceViewer/webpack-sw.config.js',
  'packages/playwright-core/src/web/recorder/webpack.config.js',
  'packages/html-reporter/webpack.config.js',
];
for (const file of webPackFiles) {
  steps.push({
    command: 'npx',
    args: ['webpack', '--config', filePath(file), ...(watchMode ? ['--watch', '--stats', 'none'] : [])],
    shell: true,
    env: {
      NODE_ENV: watchMode ? 'development' : 'production'
    }
  });
}

// Run Babel.
for (const packageDir of packages) {
  if (!fs.existsSync(path.join(packageDir, 'src')))
    continue;
  steps.push({
    command: 'npx',
    args: [
      'babel',
      ...(watchMode ? ['-w', '--source-maps'] : []),
      '--extensions', '.ts',
      '--out-dir', path.join(packageDir, 'lib'),
      '--ignore', '"packages/playwright-core/src/server/injected/**/*"',
      path.join(packageDir, 'src')],
    shell: true,
  });
}


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
  // Run TypeScript for type chekcing.
  steps.push({
    command: 'npx',
    args: ['tsc', ...(watchMode ? ['-w'] : []), '-p', filePath('.')],
    shell: true,
  });
}

watchMode ? runWatch() : runBuild();
