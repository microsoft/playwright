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
const copies = [];

const watchMode = process.argv.slice(2).includes('--watch');
const ROOT = path.join(__dirname, '..', '..');

function filePath(relative) {
  return path.join(ROOT, ...relative.split('/'));
}

function copyFile(from, to) {
  console.log(`Copying ${from} to ${to}`);
  from = filePath(from);
  const fileName = path.basename(from);
  fs.copyFileSync(from, path.join(filePath(to), fileName));
}

function throttle(fn, timeout) {
  let running = false;
  let shouldRun = false;

  const run = () => {
    running = true;
    shouldRun = false;
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      running = false;
      if (shouldRun)
        run();
    }, timeout);
  }

  return () => {
    if (running) {
      shouldRun = true;
      return;
    }
    run();
  };
}

function runWatch() {
  function runOnChanges(paths, nodeFile) {
    const callback = throttle(() => {
      console.log(`Running ${nodeFile}`);
      child_process.spawnSync('node', [filePath(nodeFile)], { stdio: 'inherit' });
      console.log(`Done running ${nodeFile}`);
    }, 2000);
    chokidar.watch([...paths, nodeFile].map(filePath)).on('all', callback);
  }

  function runCopy(from, to) {
    const callback = throttle(() => {
      copyFile(from, to);
    }, 2000);
    chokidar.watch([filePath(from)]).on('all', callback);
  }

  const spawns = [];
  for (const step of steps)
    spawns.push(child_process.spawn(step.command, step.args, { stdio: 'inherit', shell: step.shell, env: {
      ...process.env,
      ...step.env,
    } }));
  process.on('exit', () => spawns.forEach(s => s.kill()));
  for (const copy of copies)
    runCopy(copy.from, copy.to);
  for (const onChange of onChanges)
    runOnChanges(onChange.inputs, onChange.script);
}

function runBuild() {
  function runStep(command, args, shell) {
    const out = child_process.spawnSync(command, args, { stdio: 'inherit', shell });
    if (out.status)
      process.exit(out.status);
  }

  for (const copy of copies)
    copyFile(copy.from, copy.to);
  for (const step of steps)
    runStep(step.command, step.args, step.shell);
  for (const onChange of onChanges) {
    if (!onChange.committed)
      runStep('node', [filePath(onChange.script)], false);
  }
}

// NOTE: when chaning this list, consider changing .npmignore files
// for various packages.
const copyFiles = [
  'src/cli/traceViewer/web/third_party/vscode/codicon.ttf',
  'src/cli/traceViewer/web/trace-viewer.html',
  'browsers.json',
  'src/protocol/protocol.yml',
  'third_party/ffmpeg/COPYING.GPLv3',
  'third_party/ffmpeg/ffmpeg-linux',
  'third_party/ffmpeg/ffmpeg-mac',
  'third_party/ffmpeg/ffmpeg-win32.exe',
  'third_party/ffmpeg/ffmpeg-win64.exe',
  'bin/PrintDeps.exe',
  'bin/android-driver.apk',
  'bin/android-driver-target.apk',
  'types/android.d.ts',
  'types/electron.d.ts',
  'types/protocol.d.ts',
  'types/structs.d.ts',
  'types/trace.d.ts',
  'types/types.d.ts',
  'types/index.d.ts',
  'NOTICE',
  'LICENSE',
  'README.md',
  'utils/build/package-common/.npmignore',
  'utils/build/package-common/index.js',
  'utils/build/package-common/index.mjs',
  'utils/build/package-common/install.js',
];
for (const file of copyFiles)
  copies.push({ from: file, to: 'build/', });

const rollupFiles = [
  'utils/build/injectedScript.rollup.config.js',
  'utils/build/utilityScript.rollup.config.js',
  'utils/build/consoleApi.rollup.config.js',
  'utils/build/recorder.rollup.config.js',
  'utils/build/traceViewer.rollup.config.js',
  'utils/build/index.rollup.config.js',
];
for (const file of rollupFiles) {
  steps.push({
    command: 'npx',
    args: ['rollup', '-c', filePath(file), ...(watchMode ? ['-w', '--silent'] : [])],
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: watchMode ? 'development' : 'production'
    },
  });
}

// Generate api.json.
onChanges.push({
  committed: false,
  inputs: [
    'docs/src/api/',
  ],
  script: 'utils/doclint/generateApiJson.js',
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
    'src/server/chromium/protocol.ts',
    'src/trace/traceTypes.ts',
  ],
  script: 'utils/generate_types/index.js',
});

if (!watchMode)
  require('rimraf').sync(filePath('build'));
fs.mkdirSync(filePath('build'), { recursive: true });
watchMode ? runWatch() : runBuild();
