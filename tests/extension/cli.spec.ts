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

import { test as base, expect, extensionId, clickAllowAndSelect } from './extension-fixtures';

import type { CliResult } from './extension-fixtures';
import type { Page } from 'playwright';

const test = base.extend<{
  startAttach: () => Promise<{ confirmationPage: Page, cliPromise: Promise<CliResult> }>,
}>({
  startAttach: async ({ browserWithExtension, cli }, use) => {
    await use(async () => {
      const browserContext = await browserWithExtension.launch();
      const confirmationPagePromise = browserContext.waitForEvent('page', page =>
        page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
      );
      const cliPromise = cli(['attach', '--extension=chromium'], {
        env: { PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
      });
      const confirmationPage = await confirmationPagePromise;
      return { confirmationPage, cliPromise };
    });
  },
});

test('attach <url> --extension', async ({ startAttach, cli, server }) => {
  const { confirmationPage, cliPromise } = await startAttach();
  await clickAllowAndSelect(confirmationPage, 'Welcome');

  {
    const { output } = await cliPromise;
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: chrome-extension://${extensionId}/connect.html?`);
    expect(output).toContain(`- Page Title: Welcome`);
  }

  {
    const { output } = await cli(['-s=chromium', 'goto', server.HELLO_WORLD]);
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: ${server.HELLO_WORLD}`);
    expect(output).toContain(`- Page Title: Title`);
  }
});
