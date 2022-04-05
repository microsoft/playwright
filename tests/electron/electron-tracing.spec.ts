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

test.skip(({ trace }) => trace === 'on');
// test.slow();

test('should record trace', async ({ newWindow, server, runAndTrace }) => {
  const traceViewer = await runAndTrace(async () => {
    const window = await newWindow();
    await window.goto(server.PREFIX + '/input/button.html');
    await window.click('button');
    expect(await window.evaluate('result')).toBe('Clicked');
  });
  await expect(traceViewer.actionTitles).toHaveText([
    /page.goto/,
    /page.click/,
    /page.evaluate/,
  ]);
});

test('should support custom protocol', async ({ electronApp, newWindow, server, runAndTrace }) => {
  const window = await newWindow();
  await electronApp.evaluate(async ({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].loadURL('vscode-file://index.html');
  });
  const traceViewer = await runAndTrace(async () => {
    await window.click('button');
  });
  const frame = await traceViewer.snapshotFrame('page.click');
  await expect(frame.locator('button')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(frame.locator('button')).toHaveCSS('font-weight', '700');
});
