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
  server.setContent('/', `<button onclick="alert('Alert')">Button</button>`, 'text/html');
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: `- ["alert" dialog with message "Alert"]: can be handled by the "browser_handle_dialog" tool`,
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: undefined,
    modalState: `- ["alert" dialog with message "Alert"]: can be handled by the "browser_handle_dialog" tool`,
  });

  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  })).toHaveResponse({
    modalState: undefined,
    pageState: expect.stringContaining(`- button "Button"`),
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
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert 1"]: can be handled by the "browser_handle_dialog" tool`),
  });

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).toHaveResponse({
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert 2"]: can be handled by the "browser_handle_dialog" tool`),
  });

  const result2 = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result2).not.toHaveResponse({
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert 2"]: can be handled by the "browser_handle_dialog" tool`),
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
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- ["confirm" dialog with message "Confirm"]: can be handled by the "browser_handle_dialog" tool`),
  });

  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  })).toHaveResponse({
    modalState: undefined,
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: "true"`),
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
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- ["confirm" dialog with message "Confirm"]: can be handled by the "browser_handle_dialog" tool`),
  });

  expect(await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: false,
    },
  })).toHaveResponse({
    modalState: undefined,
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: "false"`),
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
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- ["prompt" dialog with message "Prompt"]: can be handled by the "browser_handle_dialog" tool`),
  });

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
      promptText: 'Answer',
    },
  });

  expect(result).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Answer`),
  });
});

test('alert dialog w/ race', async ({ client, server }) => {
  server.setContent('/', `<button onclick="setTimeout(() => alert('Alert'), 100)">Button</button>`, 'text/html');
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- button "Button" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Button' }).click();`,
    modalState: expect.stringContaining(`- ["alert" dialog with message "Alert"]: can be handled by the "browser_handle_dialog" tool`),
  });

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).toHaveResponse({
    modalState: undefined,
    pageState: expect.stringContaining(`- Page URL: ${server.PREFIX}/
- Page Title: 
- Page Snapshot:
\`\`\`yaml
- button "Button"`),
  });
});
