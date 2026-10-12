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

import { test, expect } from './cli-fixtures';

test('go-back', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('goto', server.PREFIX);
  const { output } = await cli('go-back');
  expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
});

test('go-forward', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('goto', server.HELLO_WORLD);
  await cli('go-back');
  const { output } = await cli('go-forward');
  expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
});

test('reload with alert during load', async ({ cli, server }) => {
  server.setContent('/', `<title>Title</title>`, 'text/html');
  await cli('open', server.PREFIX);
  server.setContent('/', `<title>Title</title><script>alert('MyAlert')</script><button>Button</button>`, 'text/html');
  const { output } = await cli('reload');
  expect(output).toContain('["alert" dialog with message "MyAlert"]: can be handled by dialog-accept or dialog-dismiss');
  await cli('dialog-accept');
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain('button "Button"');
});

test('go-back with dialog during navigation', async ({ cli, server }) => {
  server.setContent('/page1', `<title>Page 1</title><button>Button 1</button>`, 'text/html');
  server.setContent('/page2', `<title>Page 2</title><button id="btn">Click me</button><script>
    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = '';
    });
  </script>`, 'text/html');

  await cli('open', server.PREFIX + '/page1');
  await cli('goto', server.PREFIX + '/page2');
  await cli('click', 'e2');
  const { output } = await cli('go-back');
  expect(output).toMatch(/\["beforeunload" dialog.*\]: can be handled by dialog-accept or dialog-dismiss/);
  await cli('dialog-accept');
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain('button "Button 1"');
});

test('go-forward with dialog during navigation', async ({ cli, server }) => {
  server.setContent('/page1', `<title>Page 1</title><button id="btn1" onclick="window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
  })">Button 1</button>`, 'text/html');
  server.setContent('/page2', `<title>Page 2</title><button id="btn2">Button 2</button>`, 'text/html');

  await cli('open', server.PREFIX + '/page1');
  await cli('goto', server.PREFIX + '/page2');
  await cli('go-back');
  await cli('click', 'button');
  const { output } = await cli('go-forward');
  expect(output).toMatch(/\["beforeunload" dialog.*\]: can be handled by dialog-accept or dialog-dismiss/);
  await cli('dialog-accept');
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain('button "Button 2"');
});

test('open without url opens about:blank', async ({ cli }) => {
  const { output } = await cli('open');
  expect(output).toContain('- Page URL: about:blank');
});

test('tab-new with url', async ({ cli, server }) => {
  await cli('open');
  const { output } = await cli('tab-new', server.HELLO_WORLD);
  expect(output).toContain(`- 0: [](about:blank)`);
  expect(output).toContain(`- 1: (current) [Title](${server.HELLO_WORLD})`);
});

test('tab-new with isolated context', async ({ cli, server }) => {
  await cli('open');
  const { output } = await cli('tab-new', server.HELLO_WORLD, '--isolated-context=alice');
  expect(output).toContain(`- 1: (current) [Title](${server.HELLO_WORLD}) [isolatedContext: alice]`);
});

test('run-code', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('run-code', '() => page.title()');
  expect(output).toContain('"Title"');
});
