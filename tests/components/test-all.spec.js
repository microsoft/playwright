const { test, expect } = require('@playwright/test');

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let activeChild = undefined;

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
  if (activeChild) {
    activeChild.kill();
    activeChild = undefined;
  }
});

async function run(command, args, folder) {
  const child = spawn(command, args, {
    cwd: folder,
    stdio: 'pipe',
    shell: true,
    env: process.env
  });
  activeChild = child;
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stdout.write(data));
  process.on('exit', () => {
    activeChild = undefined;
    child.kill();
  });
  const code = await new Promise(f => child.on('close', f));
  expect(code).toEqual(0);
}
