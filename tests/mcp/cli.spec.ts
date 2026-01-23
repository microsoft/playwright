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

import { test, expect, eventsPage } from './cli-fixtures';

test.skip(({}) => process.platform === 'win32');

test.describe('help', () => {
  test('prints help by default', async ({ cliNoDaemon }) => {
    const output = await cliNoDaemon('--help');
    expect(output).toContain('Usage: playwright-cli <command>');
  });

  test('prints command help', async ({ cliNoDaemon }) => {
    const output = await cliNoDaemon('click', '--help');
    expect(output).toContain('playwright-cli click <ref> [button]');
  });
});

test.describe('core', () => {
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
    expect(output).toContain(`No open tabs. Navigate to a URL to create one.`);
  });

  test('click button', async ({ cli, server }) => {
    server.setContent('/', `<button>Submit</button>`, 'text/html');

    const { snapshot } = await cli('open', server.PREFIX);
    expect(snapshot).toContain(`- button "Submit" [ref=e2]`);

    const { snapshot: clickSnapshot } = await cli('click', 'e2');
    expect(clickSnapshot).toBeTruthy();
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

  test('check', async ({ cli, server }) => {
    server.setContent('/', `<input type="checkbox">`, 'text/html');
    await cli('open', server.PREFIX);
    await cli('check', 'e2');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('- checkbox [checked] [active] [ref=e2]');
  });

  test('uncheck', async ({ cli, server }) => {
    server.setContent('/', `<input type="checkbox" checked>`, 'text/html');
    await cli('open', server.PREFIX);
    await cli('uncheck', 'e2');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('- checkbox [active] [ref=e2]');
  });

  test('eval', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('eval', '() => document.title');
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
});

test.describe('navigation', () => {
  test('go-back', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    await cli('open', server.PREFIX);
    const { output } = await cli('go-back');
    expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
  });

  test('go-forward', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    await cli('open', server.HELLO_WORLD);
    await cli('go-back');
    const { output } = await cli('go-forward');
    expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
  });
});

test.describe('keyboard', () => {
  test('key-press', async ({ cli, server }) => {
    server.setContent('/', `<input type=text>`, 'text/html');
    await cli('open', server.PREFIX);
    await cli('click', 'e2');
    await cli('key-press', 'h');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toBe(`- textbox [active] [ref=e2]: h`);
  });

  test('key-down key-up', async ({ cli, server }) => {
    server.setContent('/', `<input type=text>`, 'text/html');
    await cli('open', server.PREFIX);
    await cli('click', 'e2');
    await cli('key-down', 'h');
    await cli('key-up', 'h');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toBe(`- textbox [active] [ref=e2]: h`);
  });
});

test.describe('mouse', () => {
  test('mouse-move', async ({ cli, server }) => {
    server.setContent('/', eventsPage, 'text/html');
    await cli('open', server.PREFIX);
    await cli('mouse-move', '45', '35');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('mouse move 45 35');
  });

  test('mouse-down mouse-up', async ({ cli, server }) => {
    server.setContent('/', eventsPage, 'text/html');
    await cli('open', server.PREFIX);
    await cli('mouse-move', '45', '35');
    await cli('mouse-down');
    await cli('mouse-up');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('mouse down');
    expect(snapshot).toContain('mouse up');
  });

  test('mouse-wheel', async ({ cli, server }) => {
    server.setContent('/', eventsPage, 'text/html');
    await cli('open', server.PREFIX);
    await cli('mouse-wheel', '10', '5');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('wheel 5 10');
  });
});


test.describe('save as', () => {
  test('screenshot', async ({ cli, server, mcpBrowser }) => {
    await cli('open', server.HELLO_WORLD);
    const { attachments } = await cli('screenshot');
    expect(attachments[0].name).toEqual('Screenshot of viewport');
    expect(attachments[0].data).toEqual(expect.any(Buffer));
  });

  test('screenshot <ref>', async ({ cli, server, mcpBrowser }) => {
    server.setContent('/', `<div id="square" style="width: 100px; height: 100px; background-color: red;"></div>`, 'text/html');
    await cli('open', server.PREFIX);
    const { attachments } = await cli('screenshot', 'e2');
    expect(attachments[0].name).toEqual('Screenshot of element');
    expect(attachments[0].data).toEqual(expect.any(Buffer));
  });

  test('screenshot --full-page', async ({ cli, server, mcpBrowser }) => {
    await cli('open', server.HELLO_WORLD);
    const { attachments } = await cli('screenshot', '--full-page');
    expect(attachments[0].name).toEqual('Screenshot of full page');
    expect(attachments[0].data).toEqual(expect.any(Buffer));
  });

  test('pdf', async ({ cli, server, mcpBrowser }) => {
    test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'PDF is only supported in Chromium and Chrome');
    await cli('open', server.HELLO_WORLD);
    const { attachments } = await cli('pdf');
    expect(attachments[0].name).toEqual('Page as pdf');
    expect(attachments[0].data).toEqual(expect.any(Buffer));
  });
});

test.describe('devtools', () => {
  test('console', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    await cli('eval', 'console.log("Hello, world!")');
    const { attachments } = await cli('console');
    expect(attachments[0].name).toEqual('Console');
    expect(attachments[0].data.toString()).toContain('Hello, world!');
  });

  test('console error', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    await cli('eval', 'console.log("log-level")');
    await cli('eval', 'console.error("error-level")');
    const { attachments } = await cli('console', 'error');
    expect(attachments[0].name).toEqual('Console');
    expect(attachments[0].data.toString()).not.toContain('log-level');
    expect(attachments[0].data.toString()).toContain('error-level');
  });

  test('console --clear', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    await cli('eval', 'console.log("log-level")');
    await cli('console', '--clear');
    const { attachments } = await cli('console');
    expect(attachments[0].name).toEqual('Console');
    expect(attachments[0].data.toString()).not.toContain('log-level');
  });

  test('network', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    await cli('eval', '() => fetch("/hello-world")');
    const { attachments } = await cli('network');
    expect(attachments[0].name).toEqual('Network');
    expect(attachments[0].data.toString()).not.toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
    expect(attachments[0].data.toString()).toContain(`[GET] ${`${server.PREFIX}/hello-world`} => [200] OK`);
  });

  test('network --static', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    const { attachments } = await cli('network', '--static');
    expect(attachments[0].name).toEqual('Network');
    expect(attachments[0].data.toString()).toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
  });

  test('network --clear', async ({ cli, server }) => {
    await cli('open', server.PREFIX);
    await cli('eval', '() => fetch("/hello-world")');
    await cli('network', '--clear');
    const { attachments } = await cli('network');
    expect(attachments[0].name).toEqual('Network');
    expect(attachments[0].data.toString()).not.toContain(`[GET] ${`${server.PREFIX}/hello-world`} => [200] OK`);
  });

  test('run-code', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('run-code', '() => page.title()');
    expect(output).toContain('"Title"');
  });

  test('tracing-start-stop', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('tracing-start');
    expect(output).toContain('Tracing started, saving to');
    await cli('eval', '() => fetch("/hello-world")');
    const { output: tracingStopOutput } = await cli('tracing-stop');
    expect(tracingStopOutput).toContain('Tracing stopped.');
  });
});
