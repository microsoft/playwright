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

test('should record trace', async ({ launchElectronApp, newWindow, server, showTraceViewer }, testInfo) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  const traceFile = testInfo.outputPath('trace.zip');
  await app.context().tracing.start({ snapshots: true, screenshots: true, sources: true });
  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
  await app.context().tracing.stop({ path: traceFile });
  const traceViewer = await showTraceViewer(traceFile);
  await expect(traceViewer.actionTitles).toHaveText([
    /Navigate/,
    /Click/,
    /Evaluate/,
  ]);
});

test('should support custom protocol', async ({ launchElectronApp, newWindow, showTraceViewer }, testInfo) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  await app.evaluate(({ BrowserWindow }) => {
    void BrowserWindow.getAllWindows()[0].loadURL('vscode-file://index.html');
  });
  const traceFile = testInfo.outputPath('trace.zip');
  await app.context().tracing.start({ snapshots: true, screenshots: true, sources: true });
  await page.click('button');
  await app.context().tracing.stop({ path: traceFile });
  const traceViewer = await showTraceViewer(traceFile);
  const frame = await traceViewer.snapshotFrame('Click');
  await expect(frame.locator('button')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(frame.locator('button')).toHaveCSS('font-weight', '700');
});
