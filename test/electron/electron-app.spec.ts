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

import { electronFixtures } from './electron.fixture';
const { it, expect, describe } = electronFixtures;

import path from 'path';
const electronName = process.platform === 'win32' ? 'electron.cmd' : 'electron';

describe('electron app', (suite, { browserName }) => {
  suite.skip(browserName !== 'chromium');
}, () => {
  it('should fire close event', async ({ playwright }) => {
    const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronName);
    const application = await playwright.electron.launch(electronPath, {
      args: [path.join(__dirname, 'testApp.js')],
    });
    const events = [];
    application.on('close', () => events.push('application'));
    application.context().on('close', () => events.push('context'));
    await application.close();
    expect(events.join('|')).toBe('context|application');
    // Give it some time to fire more events - there should not be any.
    await new Promise(f => setTimeout(f, 1000));
    expect(events.join('|')).toBe('context|application');
  });

  it('should script application', async ({ application }) => {
    const appPath = await application.evaluate(async ({ app }) => app.getAppPath());
    expect(appPath).toContain('electron');
  });

  it('should create window', async ({ application }) => {
    const [ page ] = await Promise.all([
      application.waitForEvent('window'),
      application.evaluate(({ BrowserWindow }) => {
        const window = new BrowserWindow({ width: 800, height: 600 });
        window.loadURL('data:text/html,<title>Hello World 1</title>');
      })
    ]);
    await page.waitForLoadState('domcontentloaded');
    expect(await page.title()).toBe('Hello World 1');
  });

  it('should create window 2', async ({ application }) => {
    const page = await application.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('data:text/html,<title>Hello World 2</title>');
    expect(await page.title()).toBe('Hello World 2');
  });

  it('should create multiple windows', async ({ application }) => {
    const createPage = async ordinal => {
      const page = await application.newBrowserWindow({ width: 800, height: 600 });
      await Promise.all([
        page.waitForNavigation(),
        page.browserWindow.evaluate((window, ordinal) => window.loadURL(`data:text/html,<title>Hello World ${ordinal}</title>`), ordinal)
      ]);
      return page;
    };

    const page1 = await createPage(1);
    await createPage(2);
    await createPage(3);
    await page1.close();
    await createPage(4);
    const titles = [];
    for (const window of application.windows())
      titles.push(await window.title());
    expect(titles).toEqual(['Hello World 2', 'Hello World 3', 'Hello World 4']);
  });

  it('should route network', async ({ application }) => {
    await application.context().route('**/empty.html', (route, request) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>Hello World</title>',
      });
    });
    const page = await application.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('https://localhost:1000/empty.html');
    expect(await page.title()).toBe('Hello World');
  });

  it('should support init script', async ({ application }) => {
    await application.context().addInitScript('window.magic = 42;');
    const page = await application.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('data:text/html,<script>window.copy = magic</script>');
    expect(await page.evaluate(() => window['copy'])).toBe(42);
  });

  it('should expose function', async ({ application }) => {
    await application.context().exposeFunction('add', (a, b) => a + b);
    const page = await application.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('data:text/html,<script>window["result"] = add(20, 22);</script>');
    expect(await page.evaluate(() => window['result'])).toBe(42);
  });

  it('should wait for first window', async ({ application }) => {
    application.evaluate(({ BrowserWindow }) => {
      const window = new BrowserWindow({ width: 800, height: 600 });
      window.loadURL('data:text/html,<title>Hello World!</title>');
    });
    const window = await application.firstWindow();
    expect(await window.title()).toBe('Hello World!');
  });

  it('should have a clipboard instance', async ({ application }) => {
    const clipboardContentToWrite = 'Hello from Playwright';
    await application.evaluate(async ({clipboard}, text) => clipboard.writeText(text), clipboardContentToWrite);
    const clipboardContentRead = await application.evaluate(async ({clipboard}) => clipboard.readText());
    await expect(clipboardContentRead).toEqual(clipboardContentToWrite);
  });
});
