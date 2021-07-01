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

const child_process = require('child_process');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');

const steps = [];
const onChanges = [];
const copyFiles = [];

const watchMode = process.argv.slice(2).includes('--watch');
const lintMode = process.argv.slice(2).includes('--lint');
const ROOT = path.join(__dirname, '..', '..');

function filePath(relative) {
  return path.join(ROOT, ...relative.split('/'));
}

function runWatch() {
  function runOnChanges(paths, nodeFile) {
    nodeFile = filePath(nodeFile);
    function callback() {
      child_process.spawnSync('node', [nodeFile], { stdio: 'inherit' });
    }
    chokidar.watch([...paths, nodeFile].map(filePath)).on('all', callback);
    callback();
  }

  const spawns = [];
  for (const step of steps)
    spawns.push(child_process.spawn(step.command, step.args, { stdio: 'inherit', shell: step.shell, env: {
      ...process.env,
      ...step.env,
    } }));
  process.on('exit', () => spawns.forEach(s => s.kill()));
  for (const onChange of onChanges)
    runOnChanges(onChange.inputs, onChange.script);
  for (const {files, from, to, ignored} of copyFiles) {
    const watcher = chokidar.watch([filePath(files)], {ignored});
    watcher.on('all', (event, file) => {
      copyFile(file, from, to);
    });
  }
}

async function runBuild() {
  function runStep(command, args, shell) {
    const out = child_process.spawnSync(command, args, { stdio: 'inherit', shell });
    if (out.status)
      process.exit(out.status);
  }

  for (const step of steps)
    runStep(step.command, step.args, step.shell);
  for (const onChange of onChanges) {
    if (!onChange.committed)
      runStep('node', [filePath(onChange.script)], false);
  }
  for (const {files, from, to, ignored} of copyFiles) {
    const watcher = chokidar.watch([filePath(files)], {
      ignored
    });
    watcher.on('add', file => {
      copyFile(file, from, to);
    });
    await new Promise(x => watcher.once('ready', x));
    watcher.close();
  }
}

function copyFile(file, from, to) {
  const destination = path.resolve(filePath(to), path.relative(filePath(from), file));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

// Build injected scripts.
const webPackFiles = [
  'src/server/injected/webpack.config.js',
  'src/web/traceViewer/webpack.config.js',
  'src/web/recorder/webpack.config.js',
];
for (const file of webPackFiles) {
  steps.push({
    command: 'npx',
    args: ['webpack', '--config', filePath(file), ...(watchMode ? ['--watch', '--silent'] : [])],
    shell: true,
    env: {
      NODE_ENV: watchMode ? 'development' : 'production'
    }
  });
}

// Run Babel.
steps.push({
  command: 'npx',
  args: ['babel', ...(watchMode ? ['-w'] : []), '-s', '--extensions', '.ts', '--out-dir', filePath('./lib/'), filePath('./src/')],
  shell: true,
});

// Generate channels.
onChanges.push({
  committed: false,
  inputs: [
    'src/protocol/protocol.yml'
  ],
  script: 'utils/generate_channels.js',
});

// Generate types.
onChanges.push({
  committed: false,
  inputs: [
    'docs/src/api/',
    'utils/generate_types/overrides.d.ts',
    'utils/generate_types/exported.json',
    'src/server/chromium/protocol.d.ts',
    'src/trace/traceTypes.ts',
  ],
  script: 'utils/generate_types/index.js',
});

// The recorder and trace viewer have an app_icon.png that needs to be copied.
copyFiles.push({
  files: 'src/server/chromium/*.png',
  from: 'src',
  to: 'lib',
});

// Babel doesn't touch JS files, so copy them manually.
// For example: diff_match_patch.js
copyFiles.push({
  files: 'src/**/*.js',
  from: 'src',
  to: 'lib',
  ignored: ['**/.eslintrc.js', '**/*webpack.config.js', '**/injected/**/*']
});

// Sometimes we require JSON files that babel ignores.
// For example, deviceDescriptorsSource.json
copyFiles.push({
  files: 'src/**/*.json',
  ignored: ['**/injected/**/*'],
  from: 'src',
  to: 'lib',
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
