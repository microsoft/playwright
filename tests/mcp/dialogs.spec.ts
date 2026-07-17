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

import { test, expect, parseResponse } from './fixtures';

test('alert dialog', async ({ client, server }) => {
  server.setContent('/', `<title>Title</title><button onclick="alert('Alert')">Button</button>`, 'text/html');
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: `- ["alert" dialog with message "Alert"]: can be handled by browser_handle_dialog`,
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    code: undefined,
    modalState: `- ["alert" dialog with message "Alert"]: can be handled by browser_handle_dialog`,
  });

  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  })).toHaveResponse({
    modalState: undefined,
    page: expect.stringContaining(`- Page Title: Title`),
  });
});

test('two alert dialogs', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <body>
      <button onclick="alert('Alert 1');alert('Alert 2');">Button</button>
    </body>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert 1"]: can be handled by browser_handle_dialog`),
  });

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).toHaveResponse({
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert 2"]: can be handled by browser_handle_dialog`),
  });

  const result2 = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result2).not.toHaveResponse({
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert 2"]: can be handled by browser_handle_dialog`),
  });
});

test('confirm dialog (true)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <body>
      <button onclick="document.body.textContent = confirm('Confirm')">Button</button>
    </body>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- ["confirm" dialog with message "Confirm"]: can be handled by browser_handle_dialog`),
  });

  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  })).toHaveResponse({
    modalState: undefined,
  });
});

test('confirm dialog (false)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <body>
      <button onclick="document.body.textContent = confirm('Confirm')">Button</button>
    </body>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- ["confirm" dialog with message "Confirm"]: can be handled by browser_handle_dialog`),
  });

  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: false,
    },
  })).toHaveResponse({
    modalState: undefined,
  });
});

test('prompt dialog', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <body>
      <button onclick="document.body.textContent = prompt('Prompt')">Button</button>
    </body>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- ["prompt" dialog with message "Prompt"]: can be handled by browser_handle_dialog`),
  });

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
      promptText: 'Answer',
    },
  });

  expect(result).toHaveResponse({
    modalState: undefined,
  });
});

test('dialogs handled outside of the session', async ({ cdpServer, startClient, server }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41837' });

  const browserContext = await cdpServer.start();
  // Handle dialogs from a second client attached to the same browser. To this client,
  // it is indistinguishable from the user dismissing them manually in headed mode.
  const dismissed: string[] = [];
  browserContext.on('dialog', dialog => {
    dismissed.push(dialog.message());
    void dialog.dismiss();
  });

  server.setContent('/', `
    <title>Title</title>
    <button onclick="alert('Alert 1');alert('Alert 2');alert('Alert 3')">Button</button>
  `, 'text/html');

  const { client } = await startClient({ args: [`--cdp-endpoint=${cdpServer.endpoint}`] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button"`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Button', target: 'button' },
  })).toHaveResponse({
    modalState: expect.stringContaining(`"alert" dialog`),
  });

  await expect.poll(() => dismissed).toEqual(['Alert 1', 'Alert 2', 'Alert 3']);

  // Every dialog opening proves the previous one was closed, so at most the last
  // dialog may linger as a stale modal state.
  await expect.poll(async () => {
    const response = await client.callTool({ name: 'browser_snapshot' });
    return parseResponse(response)?.modalState;
  }).toBe(`- ["alert" dialog with message "Alert 3"]: can be handled by browser_handle_dialog`);

  // Handling the stale dialog reports it was already handled instead of failing.
  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: { accept: false },
  })).toHaveResponse({
    result: expect.stringContaining(`Dialog was already handled`),
    modalState: undefined,
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    modalState: undefined,
    inlineSnapshot: expect.stringContaining(`- button "Button"`),
  });
});

test('alert dialog w/ race', async ({ client, server }) => {
  server.setContent('/', `<title>Title</title><button onclick="setTimeout(() => alert('Alert'), 100)">Button</button>`, 'text/html');
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      target: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert"]: can be handled by browser_handle_dialog`),
  });

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).toHaveResponse({
    modalState: undefined,
    page: expect.stringContaining(`- Page URL: ${server.PREFIX}/
- Page Title: Title`),
  });
});
