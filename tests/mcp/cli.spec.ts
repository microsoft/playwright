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

test.describe('help', () => {
  test('prints help by default', async ({ cli }) => {
    const { output } = await cli('--help');
    expect(output).toContain('Usage: playwright-cli <command>');
  });

  test('prints command help', async ({ cli }) => {
    const { output } = await cli('click', '--help');
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

  test('run-code', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('run-code', '() => page.title()');
    expect(output).toContain('"Title"');
  });
});

test.describe('keyboard', () => {
  test('press', async ({ cli, server }) => {
    server.setContent('/', `<input type=text>`, 'text/html');
    await cli('open', server.PREFIX);
    await cli('click', 'e2');
    await cli('press', 'h');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toBe(`- textbox [active] [ref=e2]: h`);
  });

  test('keydown keyup', async ({ cli, server }) => {
    server.setContent('/', `<input type=text>`, 'text/html');
    await cli('open', server.PREFIX);
    await cli('click', 'e2');
    await cli('keydown', 'h');
    await cli('keyup', 'h');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toBe(`- textbox [active] [ref=e2]: h`);
  });
});

test.describe('mouse', () => {
  test('mousemove', async ({ cli, server }) => {
    server.setContent('/', eventsPage, 'text/html');
    await cli('open', server.PREFIX);
    await cli('mousemove', '45', '35');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('mouse move 45 35');
  });

  test('mousedown mouseup', async ({ cli, server }) => {
    server.setContent('/', eventsPage, 'text/html');
    await cli('open', server.PREFIX);
    await cli('mousemove', '45', '35');
    await cli('mousedown');
    await cli('mouseup');
    const { snapshot } = await cli('snapshot');
    expect(snapshot).toContain('mouse down');
    expect(snapshot).toContain('mouse up');
  });

  test('mousewheel', async ({ cli, server }) => {
    server.setContent('/', eventsPage, 'text/html');
    await cli('open', server.PREFIX);
    // click to focus
    await cli('mousemove', '50', '50');
    await cli('mousedown');
    await cli('mouseup');

    await cli('mousewheel', '10', '5');

    await expect.poll(() => cli('snapshot').then(result => result.snapshot)).toContain('wheel 5 10');
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

  test('screenshot --filename', async ({ cli, server, mcpBrowser }) => {
    await cli('open', server.HELLO_WORLD);
    const { output, attachments } = await cli('screenshot', '--filename=screenshot.png');
    expect(output).toContain('.playwright-cli' + path.sep + 'screenshot.png');
    expect(attachments[0].name).toEqual('Screenshot of viewport');
    expect(attachments[0].data).toEqual(expect.any(Buffer));
  });

  test('pdf', async ({ cli, server, mcpBrowser }) => {
    test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'PDF is only supported in Chromium and Chrome');
    await cli('open', server.HELLO_WORLD);
    const { attachments } = await cli('pdf');
    expect(attachments[0].name).toEqual('Page as pdf');
    expect(attachments[0].data).toEqual(expect.any(Buffer));
  });

  test('pdf --filename', async ({ cli, server, mcpBrowser }) => {
    test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'PDF is only supported in Chromium and Chrome');
    await cli('open', server.HELLO_WORLD);
    const { output, attachments } = await cli('pdf', '--filename=pdf.pdf');
    expect(output).toContain('.playwright-cli' + path.sep + 'pdf.pdf');
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

  test('tracing-start-stop', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('tracing-start');
    expect(output).toContain('Trace recording started');
    await cli('eval', '() => fetch("/hello-world")');
    const { output: tracingStopOutput } = await cli('tracing-stop');
    expect(tracingStopOutput).toContain('Trace recording stopped');
  });

  test('video-start-stop', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);
    const { output: videoStartOutput } = await cli('video-start');
    expect(videoStartOutput).toContain('Video recording started.');
    await cli('open', server.HELLO_WORLD);
    await cli('eval', `
      async () => {
        document.body.style.backgroundColor = "red";
        for (let i = 0; i < 100; i++)
          await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
      }
    `);
    const { output: videoStopOutput } = await cli('video-stop', '--filename=video.webm');
    expect(videoStopOutput).toContain(`### Result\n- [Video](.playwright-cli${path.sep}video.webm)`);
  });
});

test.describe('config', () => {
  test('user-data-dir', async ({ cli, server }, testInfo) => {
    const config = {
      browser: {
        userDataDir: testInfo.outputPath('my-data-dir'),
      },
    };
    await fs.promises.writeFile(testInfo.outputPath('config.json'), JSON.stringify(config, null, 2));
    await cli('open', `--config=config.json`, server.PREFIX);
    expect(fs.existsSync(testInfo.outputPath('my-data-dir'))).toBe(true);
  });

  test('context options', async ({ cli, server }, testInfo) => {
    const config = {
      browser: {
        contextOptions: {
          viewport: { width: 800, height: 600 },
        },
      },
    };
    await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));
    await cli('open', server.PREFIX);
    const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(output).toContain('800x600');
  });

  test('isolated', async ({ cli, server }, testInfo) => {
    const config = {
      browser: {
        isolated: true,
      },
    };
    await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));
    await cli('open', server.PREFIX);
    expect(fs.existsSync(testInfo.outputPath('daemon', 'default-user-data'))).toBe(false);
  });
});

test.describe('session', () => {
  test('session-list', async ({ cli, server }) => {
    const { output: emptyOutput } = await cli('session-list');
    expect(emptyOutput).toContain('Sessions:');
    expect(emptyOutput).toContain('  (no sessions)');

    await cli('open', server.HELLO_WORLD);

    const { output: listOutput } = await cli('session-list');
    expect(listOutput).toContain('Sessions:');
    expect(listOutput).toContain('  [running] default');
  });

  test('session-stop', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);

    const { output } = await cli('session-stop');
    expect(output).toContain(`Session 'default' stopped.`);

    const { output: listOutput } = await cli('session-list');
    expect(listOutput).toContain('[stopped] default');
  });

  test('session-stop named session', async ({ cli, server }) => {
    await cli('open', '--session=mysession', server.HELLO_WORLD);

    const { output } = await cli('session-stop', 'mysession');
    expect(output).toContain(`Session 'mysession' stopped.`);
  });

  test('session-stop non-running session', async ({ cli }) => {
    const { output } = await cli('session-stop', 'nonexistent');
    expect(output).toContain(`Session 'nonexistent' is not running.`);
  });

  test('session-stop-all', async ({ cli, server }) => {
    await cli('open', '--session=session1', server.HELLO_WORLD);
    await cli('open', '--session=session2', server.HELLO_WORLD);

    const { output: listBefore } = await cli('session-list');
    expect(listBefore).toContain('[running] session1');
    expect(listBefore).toContain('[running] session2');

    await cli('session-stop-all');

    const { output: listAfter } = await cli('session-list');
    expect(listAfter).not.toContain('[running]');
  });

  test('session-delete', async ({ cli, server, mcpBrowser }, testInfo) => {
    await cli('open', server.HELLO_WORLD);

    const dataDir = testInfo.outputPath('daemon', 'ud-default-' + mcpBrowser);
    expect(fs.existsSync(dataDir)).toBe(true);

    const { output } = await cli('session-delete');
    expect(output).toContain(`Deleted user data for session 'default'.`);

    expect(fs.existsSync(dataDir)).toBe(false);
  });

  test('session-delete named session', async ({ cli, server, mcpBrowser }, testInfo) => {
    await cli('open', '--session=mysession', server.HELLO_WORLD);

    const dataDir = testInfo.outputPath('daemon', 'ud-mysession-' + mcpBrowser);
    expect(fs.existsSync(dataDir)).toBe(true);

    const { output } = await cli('session-delete', 'mysession');
    expect(output).toContain(`Deleted user data for session 'mysession'.`);

    expect(fs.existsSync(dataDir)).toBe(false);
  });

  test('session-delete non-existent session', async ({ cli }) => {
    const { output } = await cli('session-delete', 'nonexistent');
    expect(output).toContain(`No user data found for session 'nonexistent'.`);
  });

  test('session stops when browser exits', async ({ cli, server }) => {
    await cli('open', server.HELLO_WORLD);

    const { output: listBefore } = await cli('session-list');
    expect(listBefore).toContain('[running] default');

    // Close the browser - this will cause the daemon to exit so the command may fail
    await cli('run-code', '() => page.context().browser().close()').catch(() => {});

    await expect.poll(() => cli('session-list').then(r => r.output)).toContain('[stopped]');
  });

  test('session restart', async ({ cli, server }, testInfo) => {
    const config = { browser: { contextOptions: { viewport: { width: 700, height: 500 } } } };
    const configPath = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    {
      await cli('open', server.HELLO_WORLD, '--config=' + configPath);
      const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
      expect(output).toContain('700x500');
      await cli('close');
    }
    {
      await cli('open', server.HELLO_WORLD);
      const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
      expect(output).toContain('700x500');
    }
  });

  test('config should work', async ({ cli, server }, testInfo) => {
    // Start a session with default config
    await cli('open', server.PREFIX);
    const { output: beforeOutput } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(beforeOutput).toContain('1280x720');

    const config = {
      browser: {
        contextOptions: {
          viewport: { width: 700, height: 500 },
        },
      },
    };
    const configPath = testInfo.outputPath('session-config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

    const { output: configureOutput } = await cli('config', '--config=' + configPath);
    expect(configureOutput).toContain(`- Using config file at \`session-config.json\`.`);

    await cli('open', server.PREFIX);
    const { output: afterOutput } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(afterOutput).toContain('700x500');
  });
});

test.describe('versions', () => {
  test('old client', async ({ cli }) => {
    await cli('open', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '2.0.0' } });
    const { output: output1 } = await cli('session-list');
    expect(output1).toContain('  [running] default - v2.0.0, needs restart');

    await cli('session-stop');
    const { output: output2 } = await cli('session-list');
    expect(output2).toContain('  [stopped] default - v2.0.0, needs restart');
    await cli('session-delete');
    const { output: output3 } = await cli('session-list');
    expect(output3).toContain('  (no sessions)');
  });
});

test.describe('parsing', () => {
  test('unknown option', async ({ cli, server }) => {
    const { error, exitCode } = await cli('open', '--some-option', 'value', 'about:blank');
    expect(exitCode).toBe(1);
    expect(error).toContain(`error: unknown '--some-option' option`);
  });

  test('too many arguments', async ({ cli, server }) => {
    const { error, exitCode } = await cli('open', 'foo', 'bar');
    expect(exitCode).toBe(1);
    expect(error).toContain(`error: too many arguments: expected 1, received 2`);
  });

  test('wrong option type', async ({ cli, server }) => {
    const { error, exitCode } = await cli('type', 'foo', '--submit=bar');
    expect(exitCode).toBe(1);
    expect(error).toContain(`error: '--submit' option: expected boolean, received string`);
  });

  test('missing argument', async ({ cli, server }) => {
    const { error, exitCode } = await cli('keyup');
    expect(exitCode).toBe(1);
    expect(error).toContain(`error: 'key' argument: expected string, received undefined`);
  });

  test('wrong argument type', async ({ cli, server }) => {
    const { error, exitCode } = await cli('mousemove', '12', 'foo');
    expect(exitCode).toBe(1);
    expect(error).toContain(`error: 'y' argument: expected number, received string`);
  });
});

test.describe('folders', () => {
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
});

test.describe('isolated', () => {
  test('should not save user data', async ({ cli, server, mcpBrowser }, testInfo) => {
    await cli('open', server.HELLO_WORLD, '--isolated');
    const dataDir = testInfo.outputPath('daemon', 'ud-default-' + mcpBrowser);
    expect(fs.existsSync(dataDir)).toBe(false);
    const sessionFile = testInfo.outputPath('daemon', 'default.session');
    expect(fs.existsSync(sessionFile)).toBe(true);
    const sessionOptions = JSON.parse(await fs.promises.readFile(sessionFile, 'utf-8'));
    expect(sessionOptions).toEqual({
      cli: {
        isolated: true,
      },
      socketPath: expect.any(String),
      userDataDirPrefix: expect.any(String),
      version: expect.any(String),
    });

    const { output: listOutput } = await cli('session-list');
    expect(listOutput).toContain('Sessions:');
    expect(listOutput).toContain('  [running] default');
  });
});

test.describe('browser launch failure', () => {
  test('daemon shuts down on browser launch failure', async ({ cli, server }) => {
    const first = await cli('open', server.PREFIX, { env: { PLAYWRIGHT_MCP_EXECUTABLE_PATH: '/nonexistent/browser/path' } });
    expect(first.output).toContain('Failed to launch');

    const second = await cli('open', server.PREFIX);
    expect(second.exitCode).toBe(0);
    expect(second.output).toContain('Page URL');
  });
});

test.describe('install', () => {
  test('install', async ({ cli, server, mcpBrowser }) => {
    test.skip(mcpBrowser !== 'chromium', 'Test only chromium');
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('install');
    expect(output).toContain(`Browser ${mcpBrowser} installed.`);
  });
});
