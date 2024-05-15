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
import { test } from './npmTest';
import fs from 'fs';
import path from 'path';

test('electron should work', async ({ exec, tsc, writeFiles }) => {
  await exec('npm i playwright electron@19.0.11');
  await exec('node sanity-electron.js');
  await writeFiles({
    'test.ts':
      `import { Page, _electron, ElectronApplication, Electron } from 'playwright';`
  });
  await tsc('test.ts');
});

test('electron should work with special characters in path', async ({ exec, tmpWorkspace }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30755' });
  const folderName = path.join(tmpWorkspace, '!@#$% тест with spaces and 😊');

  await exec('npm i playwright electron@19.0.11');
  await fs.promises.mkdir(folderName);
  for (const file of ['electron-app.js', 'sanity-electron.js'])
    await fs.promises.copyFile(path.join(tmpWorkspace, file), path.join(folderName, file));
  await exec('node sanity-electron.js', {
    cwd: path.join(folderName)
  });
});
