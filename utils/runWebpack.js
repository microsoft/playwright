// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const child_process = require('child_process');
const path = require('path');

const files = [
  path.join('src', 'injected', 'zsSelectorEngine.webpack.config.js'),
  path.join('src', 'injected', 'injected.webpack.config.js'),
];

function runOne(runner, file) {
  return runner('npx', ['webpack', '--config', file, ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
  const spawns = files.map(file => runOne(child_process.spawn, file));
  process.on('exit', () => spawns.forEach(s => s.kill()));
} else {
  for (const file of files) {
    const out = runOne(child_process.spawnSync, file);
    if (out.status)
      process.exit(out.status);
  }
}
