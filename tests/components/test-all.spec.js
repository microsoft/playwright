const { test, expect } = require('@playwright/test');

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

for (const dir of fs.readdirSync(__dirname)) {
  const folder = path.join(__dirname, dir);
  if (!fs.statSync(folder).isDirectory())
    continue;
  test.describe.serial(path.basename(folder), () => {
    test.setTimeout(120000);
    test('install', async () => {
      await run('npm', ['i'], folder);
    });

    for (const project of ['chromium', 'firefox', 'webkit']) {
      test(project, async () => {
        test.setTimeout(120000);
        await run('npx', ['playwright', 'test', '--project=' + project, '--reporter=list'], folder);
      });
    }
  });
}

async function run(command, args, folder) {
  const child = spawn(command, args, {
    cwd: folder,
    stdio: 'pipe',
    shell: true,
    env: process.env
  });
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stdout.write(data));
  process.on('exit', () => {
    child.kill();
  });
  const code = await new Promise(f => child.on('close', f));
  expect(code).toEqual(0);
}
