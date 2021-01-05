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
const fs = require('fs');

const steps = [];
const onChanges = [];

const watchMode = process.argv.slice(2).includes('--watch');
const ROOT = path.join(__dirname, '..', '..');

function filePath(relative) {
  return path.join(ROOT, ...relative.split('/'));
}

function runWatch() {
  function runOnChanges(paths, nodeFile) {
    for (const p of [...paths, nodeFile]) {
      const file = filePath(p);
      if (!fs.existsSync(file)) {
        console.error('could not find file', file);
        process.exit(1);
      }
      fs.watchFile(file, callback);
    }
    callback();
    function callback() {
      child_process.spawnSync('node', [filePath(nodeFile)], { stdio: 'inherit' });
    }
  }

  const spawns = [];
  for (const step of steps)
    spawns.push(child_process.spawn(step.command, step.args, { stdio: 'inherit', shell: step.shell }));
  process.on('exit', () => spawns.forEach(s => s.kill()));
  for (const onChange of onChanges)
    runOnChanges(onChange.inputs, onChange.script);
}

function runBuild() {
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
}

// Build injected scripts.
const webPackFiles = [
  'src/server/injected/injectedScript.webpack.config.js',
  'src/server/injected/utilityScript.webpack.config.js',
  'src/debug/injected/consoleApi.webpack.config.js',
  'src/cli/injected/recorder.webpack.config.js',
];
for (const file of webPackFiles) {
  steps.push({
    command: 'npx',
    args: ['webpack', '--config', filePath(file), '--mode', 'development', ...(watchMode ? ['--watch', '--silent'] : [])],
    shell: true,
  });
}

// Run typescript.
steps.push({
  command: 'npx',
  args: ['tsc', ...(watchMode ? ['-w', '--preserveWatchOutput'] : []), '-p', filePath('.')],
  shell: true,
});

// Generate api.json.
onChanges.push({
  committed: false,
  inputs: [
    'docs/src/api-body.md',
    'docs/src/api-params.md',
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
    'docs/src/api-body.md',
    'docs/src/api-params.md',
    'utils/generate_types/overrides.d.ts',
    'utils/generate_types/exported.json',
    'src/server/chromium/protocol.ts',
    'src/trace/traceTypes.ts',
  ],
  script: 'utils/generate_types/index.js',
});

watchMode ? runWatch() : runBuild();
