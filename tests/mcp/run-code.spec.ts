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

test('browser_run_code_unsafe', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => await page.getByRole("button", { name: "Submit" }).click()';
  const response = parseResponse(await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: {
      code,
    },
  }));
  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Submit');
});

test('browser_run_code_unsafe block', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_run_code_unsafe',
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

test('browser_run_code_unsafe no-require', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: {
      code: `(page) => { require('fs'); }`,
    },
  })).toHaveResponse({
    error: expect.stringContaining(`ReferenceError: require is not defined`),
    isError: true,
  });
});

test('browser_run_code_unsafe return value', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="console.log('Submit')">Submit</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = 'async (page) => { await page.getByRole("button", { name: "Submit" }).click(); return { message: "Hello, world!" }; await page.getByRole("banner").click(); }';

  const response = parseResponse(await client.callTool({
    name: 'browser_run_code_unsafe',
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

test('browser_run_code_unsafe route handler exception keeps server alive', async ({ client, server }) => {
  server.setContent('/', '<button>Submit</button>', 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = `async (page) => {
    await page.unroute('**/*').catch(() => {});
    await page.route('**/route-throws.json', async (route) => {
      throw new Error('route handler failed');
    });
    return await page.evaluate(async () => {
      const response = await fetch('/route-throws.json');
      return response.text();
    });
  }`;
  expect(await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: { code },
  })).toHaveResponse({
    error: expect.stringContaining('route handler failed'),
    isError: true,
  });

  // Subsequent tool calls should still work because the transport remains alive.
  const followUp = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });
  expect(followUp.isError).toBeFalsy();
});

test('browser_run_code_unsafe exposes benign globals', async ({ client, server }) => {
  server.setContent('/', '<div>Hello</div>', 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = `async (page) => {
    return {
      setTimeout: typeof setTimeout,
      URL: typeof URL,
      fetch: typeof fetch,
      Buffer: typeof Buffer,
      crypto: typeof crypto,
      AbortController: typeof AbortController,
      TextEncoder: typeof TextEncoder,
      require: typeof require,
      process: typeof process,
    };
  }`;
  expect(await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: { code },
  })).toHaveResponse({
    result: JSON.stringify({
      setTimeout: 'function',
      URL: 'function',
      fetch: 'function',
      Buffer: 'function',
      crypto: 'object',
      AbortController: 'function',
      TextEncoder: 'function',
      require: 'undefined',
      process: 'undefined',
    }),
  });
});

test('browser_run_code_unsafe delayed route with setTimeout', async ({ client, server }) => {
  server.setContent('/', '<div>Hello</div>', 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const code = `async (page) => {
    await page.route('**/api/slow', async route => {
      await new Promise(r => setTimeout(r, 100));
      await route.fulfill({ body: JSON.stringify({ path: new URL(route.request().url()).pathname }) });
    });
    return await page.evaluate(async () => {
      const response = await fetch('/api/slow');
      return response.json();
    });
  }`;
  expect(await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: { code },
  })).toHaveResponse({
    result: JSON.stringify({ path: '/api/slow' }),
  });
});

test('browser_run_code_unsafe with filename', async ({ client, server }) => {
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
    name: 'browser_run_code_unsafe',
    arguments: { filename: 'test-code.js' },
  }));
  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Clicked');
});

test('browser_run_code_unsafe with filename containing template literals', async ({ client, server }) => {
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
    name: 'browser_run_code_unsafe',
    arguments: { filename: 'template-code.js' },
  }));
  const content = await consoleEntries(response);
  expect(content).toContain('[LOG] Done');
});
