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

test('should intercept dialog.showOpenDialog', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const chooserPromise = app.waitForEvent('filechooser');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showOpenDialog(win, { properties: ['openFile'] });
  });
  const chooser = await chooserPromise;
  expect(chooser.method()).toBe('showOpenDialog');
  expect(chooser.options()).toEqual(expect.objectContaining({ properties: ['openFile'] }));
  await chooser.setFiles(['/tmp/foo.txt']);
  expect(await resultPromise).toEqual({ canceled: false, filePaths: ['/tmp/foo.txt'] });
});

test('should accept a single file path as a string for setFiles', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const chooserPromise = app.waitForEvent('filechooser');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showOpenDialog(win, { properties: ['openFile'] });
  });
  const chooser = await chooserPromise;
  await chooser.setFiles('/tmp/single.txt');
  expect(await resultPromise).toEqual({ canceled: false, filePaths: ['/tmp/single.txt'] });
});

test('should cancel dialog.showOpenDialog', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const chooserPromise = app.waitForEvent('filechooser');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showOpenDialog(win, { properties: ['openFile'] });
  });
  const chooser = await chooserPromise;
  await chooser.cancel();
  expect(await resultPromise).toEqual({ canceled: true, filePaths: [] });
});

test('should intercept dialog.showSaveDialog', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const chooserPromise = app.waitForEvent('filechooser');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showSaveDialog(win, { defaultPath: 'foo.txt' });
  });
  const chooser = await chooserPromise;
  expect(chooser.method()).toBe('showSaveDialog');
  expect(chooser.options()).toEqual(expect.objectContaining({ defaultPath: 'foo.txt' }));
  await chooser.setFiles(['/tmp/bar.txt']);
  expect(await resultPromise).toEqual({ canceled: false, filePath: '/tmp/bar.txt' });
});

test('should cancel dialog.showSaveDialog', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const chooserPromise = app.waitForEvent('filechooser');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showSaveDialog(win, {});
  });
  const chooser = await chooserPromise;
  await chooser.cancel();
  expect(await resultPromise).toEqual({ canceled: true, filePath: '' });
});

test('should still expose dialog functions when no handler attached', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const present = await app.evaluate(({ dialog }) => ({
    open: typeof dialog.showOpenDialog === 'function',
    save: typeof dialog.showSaveDialog === 'function',
  }));
  expect(present).toEqual({ open: true, save: true });
});
