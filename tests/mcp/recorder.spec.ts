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

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TestServer } from '../config/testserver';

async function navigateToForm(client: Client, server: TestServer) {
  server.setContent('/', `
    <title>Title</title>
    <button>Submit</button>
    <input type="text">
  `, 'text/html');
  return await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
}

test('record actions between start and stop', async ({ client, server }) => {
  await navigateToForm(client, server);

  expect(await client.callTool({
    name: 'browser_start_recording',
  })).toHaveResponse({
    result: expect.stringContaining('Recording started'),
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: { element: 'textbox', target: 'e3', text: 'Hello world' },
  });

  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining([
      'Recording stopped. Recorded actions:',
      '',
      '```js',
      `await page.getByRole('button', { name: 'Submit' }).click();`,
      `await page.getByRole('textbox').fill('Hello world');`,
      '```',
    ].join('\n')),
  });
});

test('record navigation', async ({ client, server }) => {
  await navigateToForm(client, server);
  server.setContent('/page2', `<title>Page 2</title>`, 'text/html');

  await client.callTool({ name: 'browser_start_recording' });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page2' },
  });

  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining(`await page.goto('${server.PREFIX}/page2');`),
  });
});

test('stop with no actions recorded', async ({ client, server }) => {
  await navigateToForm(client, server);
  await client.callTool({ name: 'browser_start_recording' });
  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining('No actions were recorded.'),
  });
});

test('restarted recording only contains new actions', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <button>Alpha</button>
    <button>Beta</button>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({ name: 'browser_start_recording' });
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Alpha button', target: 'e2' },
  });
  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining(`await page.getByRole('button', { name: 'Alpha' }).click();`),
  });

  await client.callTool({ name: 'browser_start_recording' });
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Beta button', target: 'e3' },
  });
  // Matching the entire block asserts no duplicate or stale actions.
  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining([
      '```js',
      `await page.getByRole('button', { name: 'Beta' }).click();`,
      '```',
    ].join('\n')),
  });
});

test('actions performed while not recording are not included', async ({ client, server }) => {
  await navigateToForm(client, server);

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  });

  await client.callTool({ name: 'browser_start_recording' });
  await client.callTool({
    name: 'browser_type',
    arguments: { element: 'textbox', target: 'e3', text: 'Hello world' },
  });

  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining([
      '```js',
      `await page.getByRole('textbox').fill('Hello world');`,
      '```',
    ].join('\n')),
  });
});

test('record actions in python', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--codegen=python'] });
  await navigateToForm(client, server);

  await client.callTool({ name: 'browser_start_recording' });
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  });

  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    result: expect.stringContaining([
      '```python',
      `page.get_by_role("button", name="Submit").click()`,
    ].join('\n')),
  });
});

test('start twice is an error', async ({ client, server }) => {
  await navigateToForm(client, server);
  await client.callTool({ name: 'browser_start_recording' });
  expect(await client.callTool({
    name: 'browser_start_recording',
  })).toHaveResponse({
    isError: true,
    error: expect.stringContaining('Recording is already in progress'),
  });
});

test('stop without start is an error', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_stop_recording',
  })).toHaveResponse({
    isError: true,
    error: expect.stringContaining('No recording in progress'),
  });
});
