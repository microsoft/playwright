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
import { electronTest as test, expect } from './electronTest';
import { baseTest } from '../config/baseTest';

baseTest('should fire close event', async ({ playwright }) => {
  const electronApp = await playwright._electron.launch({
    args: [path.join(__dirname, 'electron-app.js')],
  });
  const events = [];
  electronApp.on('close', () => events.push('application'));
  electronApp.context().on('close', () => events.push('context'));
  await electronApp.close();
  expect(events.join('|')).toBe('context|application');
  // Give it some time to fire more events - there should not be any.
  await new Promise(f => setTimeout(f, 1000));
  expect(events.join('|')).toBe('context|application');
});

test('should script application', async ({ electronApp }) => {
  const appPath = await electronApp.evaluate(async ({ app }) => app.getAppPath());
  expect(appPath).toBe(path.resolve(__dirname));
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
  await electronApp.context().route('**/empty.html', (route, request) => {
    route.fulfill({
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
    window.loadURL('data:text/html,<title>Hello World!</title>');
  });
  const window = await electronApp.firstWindow();
  expect(await window.title()).toBe('Hello World!');
});

test('should have a clipboard instance', async ({ electronApp }) => {
  const clipboardContentToWrite = 'Hello from Playwright';
  await electronApp.evaluate(async ({clipboard}, text) => clipboard.writeText(text), clipboardContentToWrite);
  const clipboardContentRead = await electronApp.evaluate(async ({clipboard}) => clipboard.readText());
  expect(clipboardContentRead).toEqual(clipboardContentToWrite);
});

test('should test app that opens window fast', async ({ playwright }) => {
  const electronApp = await playwright._electron.launch({
    args: [path.join(__dirname, 'electron-window-app.js')],
  });
  await electronApp.close();
});

test('should return browser window', async ({ playwright }) => {
  const electronApp = await playwright._electron.launch({
    args: [path.join(__dirname, 'electron-window-app.js')],
  });
  const page = await electronApp.firstWindow();
  const bwHandle = await electronApp.browserWindow(page);
  expect(await bwHandle.evaluate((bw: BrowserWindow) => bw.title)).toBe('Electron');
  await electronApp.close();
});

test('should bypass csp', async ({playwright, server}) => {
  const app = await playwright._electron.launch({
    args: [require('path').join(__dirname, 'electron-app.js')],
    bypassCSP: true,
  });
  await app.evaluate(electron => {
    const window = new electron.BrowserWindow({
      width: 800,
      height: 600,
    });
    window.loadURL('about:blank');
  });
  const page = await app.firstWindow();
  await page.goto(server.PREFIX + '/csp.html');
  await page.addScriptTag({content: 'window["__injected"] = 42;'});
  expect(await page.evaluate('window["__injected"]')).toBe(42);
  await app.close();
});
