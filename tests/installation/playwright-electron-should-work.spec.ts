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
import { expect } from '../../packages/playwright-test';
import path from 'path';

test('electron should work', async ({ exec, tsc, writeFiles }) => {
  await exec('npm i @playwright/electron electron@39.8.4');
  await exec('node sanity-electron.js');
  await writeFiles({
    'test.ts':
      `import { electron, ElectronApplication, Electron } from '@playwright/electron';`
  });
  await tsc('test.ts');
});

test('electron should work with special characters in path', async ({ exec, tmpWorkspace }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30755' });
  const folderName = path.join(tmpWorkspace, '!@#$% тест with spaces and 😊');

  await exec('npm i @playwright/electron electron@39.8.4');
  await fs.promises.mkdir(folderName);
  for (const file of ['electron-app.js', 'sanity-electron.js'])
    await fs.promises.copyFile(path.join(tmpWorkspace, file), path.join(folderName, file));
  await exec('node sanity-electron.js', {
    cwd: path.join(folderName)
  });
});

test('should work when wrapped inside @playwright/test and trace is enabled', async ({ exec, tmpWorkspace, writeFiles }) => {
  await exec('npm i -D @playwright/test @playwright/electron electron@39.8.4');
  await writeFiles({
    'electron-with-tracing.spec.ts': `
      import { test, expect } from '@playwright/test';
      import { electron } from '@playwright/electron';

      test('should work', async ({}) => {
        const electronApp = await electron.launch({ args: [${JSON.stringify(path.join(__dirname, '../electron/electron-window-app.js'))}] });
        const window = await electronApp.firstWindow();
        await window.goto('data:text/html,<title>Playwright</title><h1>Playwright</h1>');
        await expect(window).toHaveTitle(/Playwright/);
        await expect(window.getByRole('heading')).toHaveText('Playwright');
        await electronApp.close();
      });
    `,
  });
  const jsonOutputName = test.info().outputPath('report.json');
  await exec('npx playwright test --trace=on --reporter=json electron-with-tracing.spec.ts', {
    env: { PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOutputName }
  });
  const trace = path.join(tmpWorkspace, 'test-results', 'electron-with-tracing-should-work', 'trace.zip');
  expect(fs.existsSync(trace)).toBe(true);
  const report = JSON.parse(fs.readFileSync(jsonOutputName, 'utf-8'));
  expect(report.suites[0].specs[0].tests[0].results[0].attachments.map(a => a.name)).toEqual(['trace']);
});
