const { test, expect } = require('@playwright/test');

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let activeChild = undefined;
const isWindows = process.platform === 'win32';

for (const dir of fs.readdirSync(__dirname)) {
  const folder = path.join(__dirname, dir);
  if (!fs.statSync(folder).isDirectory())
    continue;
  test.describe.serial(path.basename(folder), () => {
    test.setTimeout(7 * 60 * 1000 /* 7 minutes */);
    test('install', async () => {
      await run('npm', ['i'], folder);
    });

    test('typecheck', async () => {
      await run('npm', ['run', 'typecheck'], folder);
    });

    for (const project of ['chromium', 'firefox', 'webkit']) {
      test(project, async () => {
        await run('npx', ['playwright', 'test', '--project=' + project, '--reporter=list'], folder);
      });
    }
  });
}

test.afterEach(async () => {
  // Make sure to kill server even if timeout occurs
  onExit();
});

async function run(command, args, folder) {
  const child = spawn(command, args, {
    cwd: folder,
    stdio: 'pipe',
    env: process.env,
    shell: true,
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: !isWindows,
  });
  activeChild = child;
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stdout.write(data));
  process.on('exit', onExit);
  const code = await new Promise(f => child.on('close', f));
  expect(code).toEqual(0);
}

function onExit() {
  if (activeChild) {
    try {
      if (activeChild.exitCode !== null || activeChild.signalCode !== null)
        return;

      if (isWindows) {
        execSync(`taskkill /pid ${activeChild.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-activeChild.pid, 'SIGKILL');
      }
    } finally {
      activeChild = undefined;
    }
  }
}
