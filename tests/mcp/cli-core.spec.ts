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
import path from 'path';

import { test, expect, eventsPage } from './cli-fixtures';

test('open', async ({ cli, server }) => {
  const { output, snapshot } = await cli('open', server.HELLO_WORLD);
  expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);

  expect(snapshot).toContain(`- generic [active] [ref=e1]: Hello, world!`);
});

test('close', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('close');
  expect(output).toContain(`Session 'default' stopped.`);
});

test('click button', async ({ cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');

  const { snapshot } = await cli('open', server.PREFIX);
  expect(snapshot).toContain(`- button "Submit" [ref=e2]`);

  const { output, snapshot: clickSnapshot } = await cli('click', 'e2');
  expect(clickSnapshot).toBeTruthy();
  expect(output).toContain(`### Ran Playwright code
\`\`\`js
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\``);
});

test('click link', async ({ cli, server }) => {
  server.setContent('/', `<a href="/hello-world">Hello, world!</a>`, 'text/html');

  const { snapshot } = await cli('open', server.PREFIX);
  expect(snapshot).toContain(`- link \"Hello, world!\" [ref=e2]`);

  const { output: clickOutput, snapshot: clickSnapshot } = await cli('click', 'e2');
  expect(clickOutput).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
  expect(clickSnapshot).toContain('Hello, world!');
});

test('dblclick', async ({ cli, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await cli('open', server.PREFIX);
  const { snapshot } = await cli('dblclick', 'e2');
  expect(snapshot).toContain('dblclick 0');
});

test('type', async ({ cli, server }) => {
  server.setContent('/', `<input type=text>`, 'text/html');
  const { snapshot } = await cli('open', server.PREFIX);
  expect(snapshot).toContain(`- textbox [ref=e2]`);

  const { snapshot: typeSnapshot } = await cli('type', 'Hello, world!', '--submit');
  expect(typeSnapshot).toBe(`- textbox [ref=e2]`);
});

test('fill', async ({ cli, server }) => {
  server.setContent('/', `<input type=text>`, 'text/html');
  const { snapshot } = await cli('open', server.PREFIX);
  expect(snapshot).toContain(`- textbox [ref=e2]`);

  const { snapshot: fillSnapshot } = await cli('fill', 'e2', 'Hello, world!', '--submit');
  expect(fillSnapshot).toBe(`- textbox [active] [ref=e2]: Hello, world!`);
});

test('hover', async ({ cli, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await cli('open', server.PREFIX);
  await cli('hover', 'e2');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain('mouse move 50 50');
});

test('select', async ({ cli, server }) => {
  server.setContent('/', `<select><option value="1">One</option><option value="2">Two</option></select>`, 'text/html');
  await cli('open', server.PREFIX);
  await cli('select', 'e2', 'Two');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain('- option "Two" [selected]');
});

test('check', async ({ cli, server, mcpBrowser }) => {
  const active = mcpBrowser === 'webkit' && process.platform !== 'linux' ? '' : '[active] ';
  server.setContent('/', `<input type="checkbox">`, 'text/html');
  await cli('open', server.PREFIX);
  await cli('check', 'e2');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain(`- checkbox [checked] ${active}[ref=e2]`);
});

test('uncheck', async ({ cli, server, mcpBrowser }) => {
  const active = mcpBrowser === 'webkit' && process.platform !== 'linux' ? '' : '[active] ';
  server.setContent('/', `<input type="checkbox" checked>`, 'text/html');
  await cli('open', server.PREFIX);
  await cli('uncheck', 'e2');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain(`- checkbox ${active}[ref=e2]`);
});

test('eval', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('eval', '() => document.title');
  expect(output).toContain('"Title"');
});

test('eval no arrow', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('eval', 'document.title');
  expect(output).toContain('"Title"');
});

test('eval <ref>', async ({ cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  await cli('open', server.PREFIX);
  const { output } = await cli('eval', 'element => element.nodeName', 'e2');
  expect(output).toContain('"BUTTON"');
});

test('dialog-accept', async ({ cli, server }) => {
  server.setContent('/', `<button onclick="alert('MyAlert')">Button</button>`, 'text/html');
  await cli('open', server.PREFIX);
  const { output } = await cli('click', 'e2');
  expect(output).toContain('MyAlert');
  expect(output).toContain('["alert" dialog with message "MyAlert"]: can be handled by dialog-accept or dialog-dismiss');
  await cli('dialog-accept');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).not.toContain('MyAlert');
});

test('dialog-dismiss', async ({ cli, server }) => {
  server.setContent('/', `<button onclick="alert('MyAlert')">Button</button>`, 'text/html');
  await cli('open', server.PREFIX);
  const { output } = await cli('click', 'e2');
  expect(output).toContain('MyAlert');
  await cli('dialog-dismiss');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).not.toContain('MyAlert');
});

test('dialog-accept <prompt>', async ({ cli, server }) => {
  server.setContent('/', `<button onclick="document.body.textContent = prompt('MyAlert')">Button</button>`, 'text/html');
  await cli('open', server.PREFIX);
  await cli('click', 'e2');
  await cli('dialog-accept', 'my reply');
  const { snapshot } = await cli('snapshot');
  expect(snapshot).toContain('my reply');
});

test('resize', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('resize', '480', '320');
  const { output } = await cli('eval', '() => window.innerWidth + "x" + window.innerHeight');
  expect(output).toContain('480x320');
});

test('snapshot', async ({ cli, server }, testInfo) => {
  {
    const { output } = await cli('open', server.HELLO_WORLD);
    expect(output).toContain('.playwright-cli' + path.sep + 'page-');
  }
  {
    const nested = testInfo.outputPath('nested');
    await fs.promises.mkdir(nested, { recursive: true });
    const { output } = await cli('open', server.HELLO_WORLD, { cwd: nested });
    expect(output).toContain('..' + path.sep + '.playwright-cli' + path.sep + 'page-');
  }
});
