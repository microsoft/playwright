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

const path = require('path');
const {FIREFOX, CHROMIUM, WEBKIT} = require('playwright-runner');
const playwright = require('playwright');
const electronName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
if (!CHROMIUM)
  return
const electronEnv = require('../environments/server').serverEnv.extend({
  async beforeEach() {
    const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronName);
    const application = await playwright.electron.launch(electronPath, {
      args: [path.join(__dirname, 'testApp.js')],
    });
    return {application};
  },
  async afterEach({application}) {
    await application.close();
  }
});

describe('Electron', function() {
  const {it} = electronEnv;
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
    const page2 = await createPage(2);
    const page3 = await createPage(3);
    await page1.close();
    const page4 = await createPage(4);
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
    expect(await page.evaluate(() => copy)).toBe(42);
  });
  it('should expose function', async ({ application }) => {
    const result = new Promise(f => callback = f);
    const t = Date.now();
    await application.context().exposeFunction('add', (a, b) => a + b);
    const page = await application.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('data:text/html,<script>window.result = add(20, 22);</script>');
    expect(await page.evaluate(() => result)).toBe(42);
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

describe.skip(!CHROMIUM)('Electron per window', function() {
  const {it} = electronEnv.extend({
    async beforeEach({application}) {
      const page = await application.newBrowserWindow({ width: 800, height: 600 });
      return {page};
    },
    async afterEach({page}) {
      await page.close();
    }
  })

  it('should click the button', async ({page, server}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await page.click('button');
    expect(await page.evaluate(() => result)).toBe('Clicked');
  });
  it('should check the box', async ({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
    await page.check('input');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should not check the checked box', async ({page}) => {
    await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
    await page.check('input');
    expect(await page.evaluate(() => checkbox.checked)).toBe(true);
  });
  it('should type into a textarea', async ({page, server}) => {
    await page.evaluate(() => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();
    });
    const text = 'Hello world. I am the text that was typed!';
    await page.keyboard.type(text);
    expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe(text);
  });
});
