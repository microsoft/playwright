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
import { test, expect, extensionId } from './extension-fixtures';

test('attach <url> --extension', async ({ browserWithExtension, cli, server }, testInfo) => {
  const browserContext = await browserWithExtension.launch();

  // Write config file with userDataDir
  const configPath = testInfo.outputPath('cli-config.json');
  await fs.writeFile(configPath, JSON.stringify({
    browser: {
      userDataDir: browserWithExtension.userDataDir,
    }
  }, null, 2));

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  // Start the CLI command in the background
  const cliPromise = cli('attach', '--extension', `--config=cli-config.json`);

  // Wait for the confirmation page to appear
  const confirmationPage = await confirmationPagePromise;

  // Click the Connect button
  await confirmationPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();

  {
    // Wait for the CLI command to complete
    const { output } = await cliPromise;
    // Verify the output
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: chrome-extension://${extensionId}/connect.html?`);
    expect(output).toContain(`- Page Title: Welcome`);
  }

  {
    const { output } = await cli('goto', server.HELLO_WORLD);
    // Verify the output
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: ${server.HELLO_WORLD}`);
    expect(output).toContain(`- Page Title: Title`);
  }
});
