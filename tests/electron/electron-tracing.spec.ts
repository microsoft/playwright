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
import { parseTraceRaw } from '../config/utils';

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

test('should collect test runner artifacts', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44384' },
}, async ({ childProcess, server }, testInfo) => {
  await fs.promises.writeFile(testInfo.outputPath('playwright.config.ts'), `
    export default {
      testDir: '.',
      testMatch: '**/app.spec.ts',
      outputDir: './results',
      use: { trace: 'on', video: 'on', screenshot: 'only-on-failure' },
    };
  `);
  await fs.promises.writeFile(testInfo.outputPath('app.spec.ts'), `
    import { test as base, expect, _electron } from '@playwright/test';
    const test = base.extend({
      app: async ({}, use) => {
        const app = await _electron.launch({ args: [${JSON.stringify(require.resolve('./electron-window-app.js'))}] });
        await use(app);
        await app.close();
      },
    });
    test('fails', async ({ app }) => {
      const page = await app.firstWindow();
      await page.setContent('<button>Startup window</button>');
      await page.getByRole('button').click();
      await page.goto(${JSON.stringify(server.PREFIX + '/input/button.html')});
      await page.getByRole('button').click();
      await page.evaluate(() => console.log('electron console message'));
      const [other] = await Promise.all([
        app.waitForEvent('window'),
        app.evaluate(({ BrowserWindow }) => {
          void new BrowserWindow().loadURL('about:blank');
        }),
      ]);
      await other.setContent('<button>Second window</button>');
      await other.getByRole('button').click();
      await other.close();
      expect(1).toBe(2);
    });
  `);
  const child = childProcess({
    command: ['node', path.join(__dirname, '../../packages/playwright-test/cli.js'), 'test', '-c', testInfo.outputPath('playwright.config.ts'), '--workers=1'],
  });
  expect(await child.exitCode, child.output).toBe(1);
  expect(child.output).toContain('1 failed');

  const artifactsDir = testInfo.outputPath('results', 'app-fails');
  const { events } = await parseTraceRaw(path.join(artifactsDir, 'trace.zip'));
  expect(events).toContainEqual(expect.objectContaining({
    type: 'frame-snapshot',
    snapshot: expect.objectContaining({ frameUrl: 'about:blank' }),
  }));
  expect(events).toContainEqual(expect.objectContaining({ type: 'console', text: 'electron console message' }));
  expect(events).toContainEqual(expect.objectContaining({ type: 'resource-snapshot' }));
  expect(new Set(events.filter(e => e.type === 'frame-snapshot').map(e => e.snapshot.pageId)).size).toBe(2);
  expect(fs.readdirSync(artifactsDir)).toEqual(expect.arrayContaining(['video.webm', 'video-1.webm', 'test-failed-1.png', 'error-context.md']));
  expect(fs.statSync(path.join(artifactsDir, 'video.webm')).size).toBeGreaterThan(0);
  expect(fs.statSync(path.join(artifactsDir, 'video-1.webm')).size).toBeGreaterThan(0);
});
