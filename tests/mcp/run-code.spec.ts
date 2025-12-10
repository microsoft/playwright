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

import { test, expect } from './fixtures';

test('browser_run_code', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => await page.getByRole("button", { name: "Submit" }).click()';
  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code,
    },
  })).toHaveResponse({
    code: `await (${code})(page);`,
    consoleMessages: expect.stringContaining('- [LOG] Submit'),
  });
});

test('browser_run_code block', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: 'async (page) => { await page.getByRole("button", { name: "Submit" }).click(); await page.getByRole("button", { name: "Submit" }).click(); }',
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await page.getByRole(\"button\", { name: \"Submit\" }).click()`),
    consoleMessages: expect.stringMatching(/\[LOG\] Submit.*\n.*\[LOG\] Submit/),
  });
});

test('browser_run_code no-require', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `(page) => { require('fs'); }`,
    },
  })).toHaveResponse({
    result: expect.stringContaining(`ReferenceError: require is not defined`),
  });
});

test('browser_run_code return value', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => { await page.getByRole("button", { name: "Submit" }).click(); return { message: "Hello, world!" }; await page.getByRole("banner").click(); }';
  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code,
    },
  })).toHaveResponse({
    code: `await (${code})(page);`,
    consoleMessages: expect.stringContaining('- [LOG] Submit'),
    result: '{"message":"Hello, world!"}',
  });
});
