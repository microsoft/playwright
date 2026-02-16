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

import { test as cliTest, expect } from './cli-fixtures';

const test = cliTest.extend<{ showServer: string }>({
  showServer: async ({ startCli }, use) => {
    const show = await startCli('show', '--port=0');
    await show.waitForOutput('Listening on ');
    await use(show.output.match(/Listening on (.+)/)[1]);
  },
  baseURL: ({ showServer }, use) => use(showServer),
});

test('grid', async ({ cli, page, server }) => {
  await cli('open', server.PREFIX);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'default' })).toMatchAriaSnapshot(`
    - link /default/:
      - button "Close session"
      - img "screencast"
  `);
});

test('show with --port is blocking and does not use singleton', async ({ startCli }) => {
  const show1 = await startCli('show', '--port=0');
  await show1.waitForOutput('Listening on ');

  const show2 = await startCli('show', '--port=0');
  await show2.waitForOutput('Listening on ');

  await Promise.all([show1.kill('SIGINT'), show2.kill('SIGINT')]);
});
