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

import fs from 'fs/promises';
import { test as base, expect, extensionId } from './extension-fixtures';

import type { CliResult } from './extension-fixtures';
import type { Page } from 'playwright';

const test = base.extend<{
  startAttach: () => Promise<{ confirmationPage: Page, cliPromise: Promise<CliResult> }>,
}>({
  startAttach: async ({ browserWithExtension, cli }, use, testInfo) => {
    await use(async () => {
      await fs.writeFile(testInfo.outputPath('cli-config.json'), JSON.stringify({
        browser: {
          userDataDir: browserWithExtension.userDataDir,
        }
      }, null, 2));
      const browserContext = await browserWithExtension.launch();
      const confirmationPagePromise = browserContext.waitForEvent('page', page =>
        page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
      );
      const cliPromise = cli('attach', '--extension', `--config=cli-config.json`);
      const confirmationPage = await confirmationPagePromise;
      return { confirmationPage, cliPromise };
    });
  },
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function expectDaemonExited(cliPromise: Promise<CliResult>): Promise<void> {
  const { error } = await cliPromise;
  const pidMatch = error.match(/Daemon pid=(\d+)/);
  expect(pidMatch, `expected daemon pid in cli error:\n${error}`).toBeTruthy();
  const pid = parseInt(pidMatch![1], 10);
  await expect.poll(() => isAlive(pid)).toBe(false);
}

test('daemon exits when user rejects the extension connection', async ({ startAttach }) => {
  const { confirmationPage, cliPromise } = await startAttach();
  await confirmationPage.getByRole('button', { name: 'Reject' }).click();
  await expectDaemonExited(cliPromise);
});

test('daemon exits when user closes the connect tab', async ({ startAttach }) => {
  const { confirmationPage, cliPromise } = await startAttach();
  await confirmationPage.close();
  await expectDaemonExited(cliPromise);
});

test('attach <url> --extension', async ({ startAttach, cli, server }) => {
  const { confirmationPage, cliPromise } = await startAttach();
  await confirmationPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Allow & select' }).click();

  {
    const { output } = await cliPromise;
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: chrome-extension://${extensionId}/connect.html?`);
    expect(output).toContain(`- Page Title: Welcome`);
  }

  {
    const { output } = await cli('goto', server.HELLO_WORLD);
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: ${server.HELLO_WORLD}`);
    expect(output).toContain(`- Page Title: Title`);
  }
});
