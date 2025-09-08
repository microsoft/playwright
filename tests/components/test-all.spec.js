const { test, expect } = require('@playwright/test');

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
        process.stdout.write(`Running ${folder} in ${project}`);
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
  const pid = child.pid;
  const code = await new Promise(f => child.on('close', f));
  expect(code).toEqual(0);

  // On Windows the process tree might not be completely dead. Let's make sure
  if (process.platform === 'win32') {
    const taskkillProcess = spawnSync(`taskkill /pid ${pid} /T /F`, { shell: true });
    const [stdout, stderr] = [taskkillProcess.stdout.toString(), taskkillProcess.stderr.toString()];
    if (stdout)
      options.log(`[pid=${pid}] taskkill stdout: ${stdout}`);
    if (stderr)
      options.log(`[pid=${pid}] taskkill stderr: ${stderr}`);
  }
}
