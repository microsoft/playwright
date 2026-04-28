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

import { test, expect, parseResponse, consoleEntries } from './fixtures';

test('browser_run_code', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => await page.getByRole("button", { name: "Submit" }).click()';
  const response = parseResponse(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code,
    },
  }));
  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Submit');
});

test('browser_run_code block', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: 'async (page) => { await page.getByRole("button", { name: "Submit" }).click(); await page.getByRole("button", { name: "Submit" }).click(); }',
    },
  }));

  expect(response).toEqual(expect.objectContaining({
    code: expect.stringContaining(`await page.getByRole(\"button\", { name: \"Submit\" }).click()`),
  }));

  const content = await consoleEntries(response);
  expect(content).toMatch(/\[LOG\] Submit.*\n.*\[LOG\] Submit/);
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
    error: expect.stringContaining(`ReferenceError: require is not defined`),
    isError: true,
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

  const response = parseResponse(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code,
    },
  }));
  expect(response).toEqual(expect.objectContaining({
    code: `await (${code})(page);`,
    result: '{"message":"Hello, world!"}',
  }));

  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Submit');
});

test('browser_run_code route handler exception keeps server alive', async ({ client, server }) => {
  server.setContent('/', '<button>Submit</button>', 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = `async (page) => {
    await page.unroute('**/*').catch(() => {});
    await page.route('**/route-throws.json', async (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path }) });
    });
    return await page.evaluate(async () => {
      const response = await fetch('/route-throws.json');
      return response.text();
    });
  }`;
  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: { code },
  })).toHaveResponse({
    error: expect.stringContaining('ReferenceError: URL is not defined'),
    isError: true,
  });

  // Subsequent tool calls should still work because the transport remains alive.
  const followUp = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });
  expect(followUp.isError).toBeFalsy();
});

test('browser_run_code with filename', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Clicked')">Click</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => {\n  await page.getByRole("button", { name: "Click" }).click();\n}';
  const filePath = test.info().outputPath('test-code.js');
  await fs.promises.writeFile(filePath, code);

  const response = parseResponse(await client.callTool({
    name: 'browser_run_code',
    arguments: { filename: 'test-code.js' },
  }));
  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Clicked');
});

test('browser_run_code with filename containing template literals', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Done')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => {\n  const title = `Page: ${await page.title()}`;\n  await page.getByRole("button", { name: "Submit" }).click();\n  return title;\n}';
  const filePath = test.info().outputPath('template-code.js');
  await fs.promises.writeFile(filePath, code);

  const response = parseResponse(await client.callTool({
    name: 'browser_run_code',
    arguments: { filename: 'template-code.js' },
  }));
  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Done');
});
