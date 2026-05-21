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

test('should intercept dialog.showMessageBox', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const dialogPromise = app.waitForEvent('dialog');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showMessageBox(win, { buttons: ['OK', 'Cancel'], message: 'Hi' });
  });
  const dialog = await dialogPromise;
  expect(dialog.method()).toBe('showMessageBox');
  expect(dialog.options()).toEqual(expect.objectContaining({ buttons: ['OK', 'Cancel'] }));
  await dialog.accept({ response: 1, checkboxChecked: true });
  expect(await resultPromise).toEqual({ response: 1, checkboxChecked: true });
});

test('should dismiss dialog.showMessageBox with default result', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const dialogPromise = app.waitForEvent('dialog');
  const resultPromise = app.evaluate(({ dialog, BrowserWindow }) => {
    const win = new BrowserWindow({ width: 400, height: 300, show: false });
    return dialog.showMessageBox(win, { buttons: ['OK', 'Cancel'], message: 'Hi' });
  });
  const dialog = await dialogPromise;
  await dialog.dismiss();
  expect(await resultPromise).toEqual({ response: 0, checkboxChecked: false });
});

test('should still expose showMessageBox when no handler attached', async ({ launchElectronApp }) => {
  const app = await launchElectronApp('electron-app.js');
  const present = await app.evaluate(({ dialog }) => typeof dialog.showMessageBox === 'function');
  expect(present).toBe(true);
});
