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

import fs from 'fs';
import { test, expect } from './cli-fixtures';

test.describe.configure({
  retries: 1,
});

test('cdp server', async ({ cdpServer, cli, server }) => {
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.HELLO_WORLD);

  const configPath = test.info().outputPath('config.ini');
  await fs.promises.writeFile(configPath, `
browser.cdpEndpoint=${cdpServer.endpoint}
browser.isolated=false
`);
  await cli('open', `--config=${configPath}`);
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain(`- generic [active] [ref=e1]: Hello, world!`);
});
