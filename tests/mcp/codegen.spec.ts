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
import { test, expect } from './fixtures';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function navigateToForm(client: Client, server: any) {
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

test('codegen python', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--codegen=python'] });
  expect(await navigateToForm(client, server)).toHaveResponse({
    code: `page.goto("${server.PREFIX}")`,
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  })).toHaveResponse({
    code: `page.get_by_role("button", name="Submit").click()`,
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2', modifiers: ['Control'] },
  })).toHaveResponse({
    code: `page.get_by_role("button", name="Submit").click(modifiers=["ControlOrMeta"])`,
  });

  expect(await client.callTool({
    name: 'browser_type',
    arguments: { element: 'textbox', target: 'e3', text: `it's a secret`, submit: true },
  })).toHaveResponse({
    code: `page.get_by_role("textbox").fill("it's a secret")\npage.get_by_role("textbox").press("Enter")`,
  });

  // Page-level keyboard input has no action equivalent and stays as JavaScript.
  expect(await client.callTool({
    name: 'browser_press_key',
    arguments: { key: 'Escape' },
  })).toHaveResponse({
    code: `// Press Escape\nawait page.keyboard.press('Escape');`,
  });
});

test('codegen java', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--codegen=java'] });
  expect(await navigateToForm(client, server)).toHaveResponse({
    code: `page.navigate("${server.PREFIX}");`,
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  })).toHaveResponse({
    code: `page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Submit")).click();`,
  });

  expect(await client.callTool({
    name: 'browser_type',
    arguments: { element: 'textbox', target: 'e3', text: 'hello', submit: false },
  })).toHaveResponse({
    code: `page.getByRole(AriaRole.TEXTBOX).fill("hello");`,
  });
});

test('codegen csharp', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--codegen=csharp'] });
  expect(await navigateToForm(client, server)).toHaveResponse({
    code: `await page.GotoAsync("${server.PREFIX}");`,
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  })).toHaveResponse({
    code: `await page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();`,
  });

  expect(await client.callTool({
    name: 'browser_type',
    arguments: { element: 'textbox', target: 'e3', text: 'hello', submit: false },
  })).toHaveResponse({
    code: `await page.GetByRole(AriaRole.Textbox).FillAsync("hello");`,
  });
});

test('codegen verify tools', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--codegen=python', '--caps=testing'] });
  await navigateToForm(client, server);
  await client.callTool({
    name: 'browser_type',
    arguments: { element: 'textbox', target: 'e3', text: 'hello', submit: false },
  });

  expect(await client.callTool({
    name: 'browser_verify_value',
    arguments: { type: 'textbox', element: 'textbox', target: 'e3', value: 'hello' },
  })).toHaveResponse({
    code: `expect(page.get_by_role("textbox")).to_have_value("hello")`,
  });
});

test('codegen renders secrets as environment lookups', async ({ startClient, server }) => {
  const secretsFile = test.info().outputPath('secrets.env');
  await fs.promises.writeFile(secretsFile, 'X-PASSWORD=password123');

  for (const [language, code] of [
    ['typescript', `await page.getByRole('textbox').fill(process.env['X-PASSWORD']);`],
    ['python', `page.get_by_role("textbox").fill(os.environ["X-PASSWORD"])`],
    ['java', `page.getByRole(AriaRole.TEXTBOX).fill(System.getenv("X-PASSWORD"));`],
    ['csharp', `await page.GetByRole(AriaRole.Textbox).FillAsync(Environment.GetEnvironmentVariable("X-PASSWORD"));`],
  ] as const) {
    const { client } = await startClient({ args: [`--codegen=${language}`, '--secrets', secretsFile] });
    await navigateToForm(client, server);
    expect(await client.callTool({
      name: 'browser_type',
      arguments: { element: 'textbox', target: 'e3', text: 'X-PASSWORD', submit: false },
    })).toHaveResponse({ code });
    await client.close();
  }
});

test('codegen falls back to JavaScript for scripted lines', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--codegen=python'] });
  await navigateToForm(client, server);

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => document.title' },
  })).toHaveResponse({
    code: `await page.evaluate('() => document.title');`,
  });
});
