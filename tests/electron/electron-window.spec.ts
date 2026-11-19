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

import { electronTest as test, expect } from './electronTest';

test('should click the button', async ({ launchElectronApp, newWindow, server }) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

test('should check the box', async ({ launchElectronApp, newWindow }) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await page.check('input');
  expect(await page.evaluate('checkbox.checked')).toBe(true);
});

test('should not check the checked box', async ({ launchElectronApp, newWindow }) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  await page.setContent(`<input id='checkbox' type='checkbox' checked></input>`);
  await page.check('input');
  expect(await page.evaluate('checkbox.checked')).toBe(true);
});

test('should type into a textarea', async ({ launchElectronApp, newWindow }) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  await page.evaluate(() => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
  });
  const text = 'Hello world. I am the text that was typed!';
  await page.keyboard.type(text);
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe(text);
});

test('should not keep webview guest frames in the host page', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44223' } }, async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  await app.evaluate(({ BrowserWindow }) => {
    const window = new BrowserWindow({ webPreferences: { webviewTag: true } });
    void window.loadURL('about:blank');
  });
  const page = await app.firstWindow();
  await page.evaluate(async () => {
    const webview = document.createElement('webview');
    const loaded = new Promise<void>(resolve => webview.addEventListener('did-finish-load', () => resolve()));
    webview.setAttribute('src', 'data:text/html,guest');
    document.body.innerHTML = '<h1>host</h1>';
    document.body.appendChild(webview);
    await loaded;
  });
  await expect.poll(() => page.frames()).toEqual([page.mainFrame()]);
  const start = Date.now();
  expect(await page.locator('body').ariaSnapshot({ mode: 'ai', timeout: 5000 })).toContain('heading "host"');
  expect(Date.now() - start).toBeLessThan(2500);
});
