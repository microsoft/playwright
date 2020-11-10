/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { _clank } = require('..');
const assert = require('assert');
const childProcess = require('child_process');
const path = require('path');
const readline = require('readline');

(async () => {
  setTimeout(() => {
    console.error('Timed out starting emulator');
    process.exit(1);
  }, 60000);
  const proc = childProcess.spawn(path.join(process.cwd(), '.android-sdk/emulator/emulator'), ['-no-window', '-avd', 'android30', '-verbose'], {
    env: {
      ...process.env,
      ANDROID_SDK_ROOT: path.join(process.cwd(), '.android-sdk'),
      ANDROID_HOME: path.join(process.cwd(), '.android-sdk'),
    }
  });
  proc.stdout.on('data', data => console.log(data.toString()));
  proc.stderr.on('data', data => console.log(data.toString()));
  await waitForLine(proc, /boot completed/);

  const context = await _clank.launchPersistentContext('');
  const [page] = context.pages();
  await page.goto('data:text/html,<title>Hello world</title>');
  assert(await page.title() === 'Hello world');
  await context.close();
  process.exit(0);
})();

async function waitForLine(proc, regex) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: proc.stdout });
    const failError = new Error('Process failed to launch!');
    rl.on('line', onLine);
    rl.on('close', reject.bind(null, failError));
    proc.on('exit', reject.bind(null, failError));
    proc.on('error', reject.bind(null, failError));

    function onLine(line) {
      const match = line.match(regex);
      if (!match)
        return;
      resolve(match);
    }
  });
}
