/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import type { Browser, Page } from '../../../index';
import { showTraceViewer } from '../../../lib/server/trace/viewer/traceViewer';
import { playwrightTest } from '../../config/browserTest';
import { expect } from '../../config/test-runner';

class TraceViewerPage {
  constructor(public page: Page) {}

  async actionTitles() {
    await this.page.waitForSelector('.action-title:visible');
    return await this.page.$$eval('.action-title:visible', ee => ee.map(e => e.textContent));
  }

  async selectAction(title: string) {
    await this.page.click(`.action-title:text("${title}")`);
  }

  async logLines() {
    await this.page.waitForSelector('.log-line:visible');
    return await this.page.$$eval('.log-line:visible', ee => ee.map(e => e.textContent));
  }

  async eventBars() {
    await this.page.waitForSelector('.timeline-bar.event:visible');
    const list = await this.page.$$eval('.timeline-bar.event:visible', ee => ee.map(e => e.className));
    const set = new Set<string>();
    for (const item of list) {
      for (const className of item.split(' '))
        set.add(className);
    }
    const result = [...set];
    return result.sort();
  }
}

const test = playwrightTest.extend<{ showTraceViewer: (trace: string) => Promise<TraceViewerPage> }>({
  showTraceViewer: async ({ browserType, browserName, headless }, use) => {
    let browser: Browser;
    let contextImpl: any;
    await use(async (trace: string) => {
      contextImpl = await showTraceViewer(trace, browserName, headless);
      browser = await browserType.connectOverCDP({ endpointURL: contextImpl._browser.options.wsEndpoint });
      return new TraceViewerPage(browser.contexts()[0].pages()[0]);
    });
    await browser.close();
    await contextImpl._browser.close();
  }
});

let traceFile: string;

test.beforeAll(async ({ browser }, workerInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ name: 'test', screenshots: true, snapshots: true });
  const page = await context.newPage();
  await page.goto('data:text/html,<html>Hello world</html>');
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await Promise.all([
    page.waitForNavigation(),
    page.waitForTimeout(200).then(() => page.goto('data:text/html,<html>Hello world 2</html>'))
  ]);
  await page.evaluate(() => {
    console.log('Log');
    console.warn('Warning');
    console.error('Error');
  });
  await page.close();
  traceFile = path.join(workerInfo.project.outputDir, 'trace.zip');
  await context.tracing.stop({ path: traceFile });
});

test('should show empty trace viewer', async ({ showTraceViewer }, testInfo) => {
  const traceViewer = await showTraceViewer(testInfo.outputPath());
  expect(await traceViewer.page.title()).toBe('Playwright Trace Viewer');
});

test('should open simple trace viewer', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  expect(await traceViewer.actionTitles()).toEqual([
    'page.goto',
    'page.setContent',
    'page.click',
    'page.waitForNavigation',
    'page.goto',
    'page.evaluate'
  ]);
});

test('should contain action log', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  await traceViewer.selectAction('page.click');

  const logLines = await traceViewer.logLines();
  expect(logLines.length).toBeGreaterThan(10);
  expect(logLines).toContain('attempting click action');
  expect(logLines).toContain('  click action done');
});

test('should render events', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  const events = await traceViewer.eventBars();
  expect(events).toContain('page_console');
});
