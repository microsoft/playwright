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

test('dialog closed out of band', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41837' },
}, async ({ cdpServer, startClient, server }) => {
  server.setContent('/', `<title>Title</title><button onclick="alert('Alert')">Button</button>`, 'text/html');

  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  // Subscribe to the dialog event to prevent this connection from auto-dismissing dialogs.
  page.on('dialog', () => {});
  // Establish the CDP session up front: creating one while a dialog is blocking the page hangs.
  const cdpSession = await browserContext.newCDPSession(page);
  await cdpSession.send('Page.enable');

  const { client } = await startClient({ args: [`--cdp-endpoint=${cdpServer.endpoint}`] });

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
    modalState: `- ["alert" dialog with message "Alert"]: can be handled by browser_handle_dialog`,
  });

  // Close the dialog through CDP as a side-channel, similar to the user closing it in the headed browser.
  const closedPromise = page.waitForEvent('dialogclosed');
  await cdpSession.send('Page.handleJavaScriptDialog', { accept: true });
  await closedPromise;

  await expect.poll(() => client.callTool({
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
