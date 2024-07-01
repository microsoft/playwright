/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { electronTest as test, expect } from './electronTest';
import type { ConsoleMessage } from 'playwright';

test('should fire close event via ElectronApplication.close();', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app.js');
  const events = [];
  electronApp.on('close', () => events.push('application(close)'));
  electronApp.context().on('close', () => events.push('context(close)'));
  electronApp.process().on('exit', () => events.push('process(exit)'));
  await electronApp.close();
  // Close one more time - this should be a noop.
  await electronApp.close();
  events.sort(); // we don't care about the order
  expect(events).toEqual(['application(close)', 'context(close)', 'process(exit)']);
  // Give it some time to fire more events - there should not be any.
  await new Promise(f => setTimeout(f, 1000));
  expect(events).toEqual(['application(close)', 'context(close)', 'process(exit)']);
});

test('should fire close event via BrowserContext.close()', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app.js');
  const events = [];
  electronApp.on('close', () => events.push('application(close)'));
  electronApp.context().on('close', () => events.push('context(close)'));
  electronApp.process().on('exit', () => events.push('process(exit)'));
  await electronApp.context().close();
  // Close one more time - this should be a noop.
  await electronApp.context().close();
  events.sort(); // we don't care about the order
  expect(events).toEqual(['application(close)', 'context(close)', 'process(exit)']);
  // Give it some time to fire more events - there should not be any.
  await new Promise(f => setTimeout(f, 1000));
  expect(events).toEqual(['application(close)', 'context(close)', 'process(exit)']);
});

test('should fire close event when the app quits itself', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app.js');
  const events = [];
  electronApp.on('close', () => events.push('application(close)'));
  electronApp.context().on('close', () => events.push('context(close)'));
  electronApp.process().on('exit', () => events.push('process(exit)'));
  {
    const waitForAppClose = new Promise<void>(f => electronApp.on('close', f));
    await electronApp.evaluate(({ app }) => app.quit());
    await waitForAppClose;
  }
  events.sort(); // we don't care about the order
  expect(events).toEqual(['application(close)', 'context(close)', 'process(exit)']);
  // Give it some time to fire more events - there should not be any.
  await new Promise(f => setTimeout(f, 1000));
  expect(events).toEqual(['application(close)', 'context(close)', 'process(exit)']);
});

test('should fire console events', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app.js');
  const messages = [];
  electronApp.on('console', message => messages.push({ type: message.type(), text: message.text() }));
  await electronApp.evaluate(() => {
    console.log('its type log');
    console.debug('its type debug');
    console.info('its type info');
    console.error('its type error');
    console.warn('its type warn');
  });
  await electronApp.close();
  expect(messages).toEqual([
    { type: 'log', text: 'its type log' },
    { type: 'debug', text: 'its type debug' },
    { type: 'info', text: 'its type info' },
    { type: 'error', text: 'its type error' },
    { type: 'warning', text: 'its type warn' },
  ]);
});

test('should fire console events with handles and complex objects', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app.js');
  const messages: ConsoleMessage[] = [];
  electronApp.on('console', message => messages.push(message));
  await electronApp.evaluate(() => {
    globalThis.complexObject = [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }, { a: 7, b: 8, c: 9 }];
    console.log(globalThis.complexObject[0], globalThis.complexObject[1], globalThis.complexObject[2]);
  });
  expect(messages.length).toBe(1);
  const message = messages[0];
  expect(message.text()).toBe('{a: 1, b: 2, c: 3} {a: 4, b: 5, c: 6} {a: 7, b: 8, c: 9}');
  expect(message.args().length).toBe(3);
  expect(await message.args()[0].jsonValue()).toEqual({ a: 1, b: 2, c: 3 });
  expect(await message.args()[0].evaluate(part => part === globalThis.complexObject[0])).toBeTruthy();
  expect(await message.args()[1].jsonValue()).toEqual({ a: 4, b: 5, c: 6 });
  expect(await message.args()[1].evaluate(part => part === globalThis.complexObject[1])).toBeTruthy();
  expect(await message.args()[2].jsonValue()).toEqual({ a: 7, b: 8, c: 9 });
  expect(await message.args()[2].evaluate(part => part === globalThis.complexObject[2])).toBeTruthy();
  await electronApp.close();
});

test('should dispatch ready event', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app-ready-event.js');
  const events = await electronApp.evaluate(() => globalThis.__playwrightLog);
  expect(events).toEqual([
    'isReady == false',
    'will-finish-launching fired',
    'ready fired',
    'whenReady resolved',
    'isReady == true',
  ]);
});

test('should script application', async ({ electronApp }) => {
  const appPath = await electronApp.evaluate(async ({ app }) => app.getAppPath());
  expect(appPath).toBe(path.resolve(__dirname));
});

test('should preserve args', async ({ launchElectronApp, isMac }) => {
  const electronApp = await launchElectronApp('electron-app-args.js', ['foo', 'bar']);
  const argv = await electronApp.evaluate(async () => globalThis.argv);
  const electronPath = isMac ? path.join('dist', 'Electron.app') : path.join('dist', 'electron');
  expect(argv).toEqual([expect.stringContaining(electronPath), expect.stringContaining(path.join('electron', 'electron-app-args.js')), 'foo', 'bar']);
});

test('should return windows', async ({ electronApp, newWindow }) => {
  const window = await newWindow();
  expect(electronApp.windows()).toEqual([window]);
});

test('should evaluate handle', async ({ electronApp }) => {
  const appHandle = await electronApp.evaluateHandle(({ app }) => app);
  expect(await electronApp.evaluate(({ app }, appHandle) => app === appHandle, appHandle)).toBeTruthy();
});

test('should route network', async ({ electronApp, newWindow }) => {
  await electronApp.context().route('**/empty.html', async (route, request) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>Hello World</title>',
    });
  });
  const window = await newWindow();
  await window.goto('https://localhost:1000/empty.html');
  expect(await window.title()).toBe('Hello World');
});

test('should support init script', async ({ electronApp, newWindow }) => {
  await electronApp.context().addInitScript('window.magic = 42;');
  const window = await newWindow();
  await window.goto('data:text/html,<script>window.copy = magic</script>');
  expect(await window.evaluate(() => window['copy'])).toBe(42);
});

test('should expose function', async ({ electronApp, newWindow }) => {
  await electronApp.context().exposeFunction('add', (a, b) => a + b);
  const window = await newWindow();
  await window.goto('data:text/html,<script>window["result"] = add(20, 22);</script>');
  expect(await window.evaluate(() => window['result'])).toBe(42);
});

test('should wait for first window', async ({ electronApp }) => {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const window = new BrowserWindow({ width: 800, height: 600 });
    void window.loadURL('data:text/html,<title>Hello World!</title>');
  });
  const window = await electronApp.firstWindow();
  expect(await window.title()).toBe('Hello World!');
});

test('should have a clipboard instance', async ({ electronApp }) => {
  const clipboardContentToWrite = 'Hello from Playwright';
  await electronApp.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), clipboardContentToWrite);
  const clipboardContentRead = await electronApp.evaluate(async ({ clipboard }) => clipboard.readText());
  expect(clipboardContentRead).toEqual(clipboardContentToWrite);
});

test('should test app that opens window fast', async ({ launchElectronApp }) => {
  await launchElectronApp('electron-window-app.js');
});

test('should return browser window', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-window-app.js');
  const page = await electronApp.firstWindow();
  const bwHandle = await electronApp.browserWindow(page);
  expect(await bwHandle.evaluate((bw: BrowserWindow) => bw.title)).toBe('Electron');
});

test('should bypass csp', async ({ launchElectronApp, server }) => {
  const app = await launchElectronApp('electron-app.js', [], { bypassCSP: true });
  await app.evaluate(electron => {
    const window = new electron.BrowserWindow({
      width: 800,
      height: 600,
    });
    void window.loadURL('about:blank');
  });
  const page = await app.firstWindow();
  await page.goto(server.PREFIX + '/csp.html');
  await page.addScriptTag({ content: 'window["__injected"] = 42;' });
  expect(await page.evaluate('window["__injected"]')).toBe(42);
});

test('should create page for browser view', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-window-app.js');
  await app.firstWindow();
  await app.evaluate(async electron => {
    const window = electron.BrowserWindow.getAllWindows()[0];
    const view = new electron.BrowserView();
    window.addBrowserView(view);
    await view.webContents.loadURL('about:blank');
    view.setBounds({ x: 0, y: 0, width: 256, height: 256 });
  });
  await expect.poll(() => app.windows().length).toBe(2);
});

test('should return same browser window for browser view pages', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-window-app.js');
  await app.firstWindow();
  await app.evaluate(async electron => {
    const window = electron.BrowserWindow.getAllWindows()[0];
    const view = new electron.BrowserView();
    window.addBrowserView(view);
    await view.webContents.loadURL('about:blank');
    view.setBounds({ x: 0, y: 0, width: 256, height: 256 });
  });
  await expect.poll(() => app.windows().length).toBe(2);
  const [firstWindowId, secondWindowId] = await Promise.all(
      app.windows().map(async page => {
        const bwHandle = await app.browserWindow(page);
        const id = await bwHandle.evaluate((bw: BrowserWindow) => bw.id);
        return id;
      })
  );
  expect(firstWindowId).toEqual(secondWindowId);
});

test('should record video', async ({ launchElectronApp }, testInfo) => {
  const app = await launchElectronApp('electron-window-app.js', [], {
    recordVideo: { dir: testInfo.outputPath('video') }
  });
  const page = await app.firstWindow();
  await page.setContent(`<style>body {background:red}</style>`);
  await page.waitForTimeout(1000);
  await app.close();
  const videoPath = await page.video().path();
  expect(fs.statSync(videoPath).size).toBeGreaterThan(0);
});

test('should record har', async ({ launchElectronApp, server }, testInfo) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30747' });
  const app = await launchElectronApp('electron-window-app.js', [], {
    recordHar: { path: testInfo.outputPath('har.zip') }
  });
  const page = await app.firstWindow();
  await page.goto(server.EMPTY_PAGE);
  await app.close();
  expect(fs.existsSync(testInfo.outputPath('har.zip'))).toBeTruthy();
  expect(fs.statSync(testInfo.outputPath('har.zip')).size).toBeGreaterThan(0);
});

test('should be able to get the first window when with a delayed navigation', async ({ launchElectronApp }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/17765' });

  const app = await launchElectronApp('electron-window-app-delayed-loadURL.js');
  const page = await app.firstWindow();
  await expect(page).toHaveURL('data:text/html,<h1>Foobar</h1>');
  await expect(page.locator('h1')).toHaveText('Foobar');
});

test('should detach debugger on app-initiated exit', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('electron-app.js');
  const closePromise = new Promise(f => electronApp.process().on('close', f));
  await electronApp.evaluate(({ app }) => {
    app.quit();
  });
  await closePromise;
});

test('should run pre-ready apis', async ({ launchElectronApp }) => {
  await launchElectronApp('electron-app-pre-ready.js');
});

test('should resolve app path for folder apps', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('.');
  const appPath = await electronApp.evaluate(async ({ app }) => app.getAppPath());
  expect(appPath).toBe(path.resolve(__dirname));
});

test('should return app name / version from manifest', async ({ launchElectronApp }) => {
  const electronApp = await launchElectronApp('.');
  const data = await electronApp.evaluate(async ({ app }) => {
    return {
      name: app.getName(),
      version: app.getVersion(),
    };
  });
  expect(data).toEqual({
    name: 'my-electron-app',
    version: '1.0.0'
  });
});

test('should report downloads', async ({ launchElectronApp, electronMajorVersion, server }) => {
  test.skip(electronMajorVersion < 30, 'Depends on https://github.com/electron/electron/pull/41718');

  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });

  const app = await launchElectronApp('electron-window-app.js', [], {
    acceptDownloads: true,
  });
  const window = await app.firstWindow();
  await window.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [download] = await Promise.all([
    window.waitForEvent('download'),
    window.click('a')
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
  await app.close();
});
