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
import fs from 'fs';
import path from 'path';

test.skip(({ trace }) => trace === 'on');

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
  await electronApp.evaluate(({ BrowserWindow }) => {
    void BrowserWindow.getAllWindows()[0].loadURL('vscode-file://index.html');
  });
  const traceViewer = await runAndTrace(async () => {
    await window.click('button');
  });
  const frame = await traceViewer.snapshotFrame('page.click');
  await expect(frame.locator('button')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(frame.locator('button')).toHaveCSS('font-weight', '700');
});

test('should respect tracesDir and name', async ({ launchElectronApp, server }, testInfo) => {
  const tracesDir = testInfo.outputPath('traces');
  const electronApp = await launchElectronApp('electron-window-app.js', [], { tracesDir });

  await electronApp.context().tracing.start({ name: 'name1', snapshots: true });
  const page = await electronApp.firstWindow();
  await page.goto(server.PREFIX + '/one-style.html');
  await electronApp.context().tracing.stopChunk({ path: testInfo.outputPath('trace1.zip') });
  expect(fs.existsSync(path.join(tracesDir, 'name1.trace'))).toBe(true);
  expect(fs.existsSync(path.join(tracesDir, 'name1.network'))).toBe(true);

  await electronApp.close();
});
