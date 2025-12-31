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

test('browser_run_code blocks fetch of file:// URLs by default', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `async (page) => { await page.request.get('file:///etc/passwd'); }`,
    },
  })).toHaveResponse({
    result: expect.stringContaining('Error: apiRequestContext.get: Access to "file:" URL is blocked. Allowed protocols: http:, https:, about:, data:. Attempted URL: file:///etc/passwd'),
    isError: true,
  });
});

test('browser_run_code restricts setInputFiles to roots by default', async ({ startClient, server }, testInfo) => {
  const rootDir = testInfo.outputPath('workspace');
  await fs.mkdir(rootDir, { recursive: true });

  const { client } = await startClient({
    roots: [
      {
        name: 'workspace',
        uri: `file://${rootDir}`,
      }
    ],
  });

  server.setContent('/', `<input type="file" />`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Create a file inside the root
  const fileInsideRoot = testInfo.outputPath('workspace', 'inside.txt');
  await fs.writeFile(fileInsideRoot, 'Inside root');

  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `async (page) => {
      await page.locator('input').setInputFiles('${fileInsideRoot.replace(/\\/g, '\\\\')}');
      return 'success';
    }`,
    },
  })).toHaveResponse({
    result: '"success"',
  });

  // Create a file outside the root
  const fileOutsideRoot = testInfo.outputPath('outside.txt');
  await fs.writeFile(fileOutsideRoot, 'Outside root');

  expect(await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `(page) => page.locator('input').setInputFiles('${fileOutsideRoot.replace(/\\/g, '\\\\')}')`,
    },
  })).toHaveResponse({
    isError: true,
    result: expect.stringMatching('File access denied: .* is outside allowed roots'),
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
