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
import type { Browser, Locator, Page } from '../../index';
import { showTraceViewer } from '../../lib/server/trace/viewer/traceViewer';
import { playwrightTest, expect } from '../config/browserTest';

class TraceViewerPage {
  actionTitles: Locator;
  callLines: Locator;
  consoleLines: Locator;
  consoleLineMessages: Locator;
  consoleStacks: Locator;
  stackFrames: Locator;

  constructor(public page: Page) {
    this.actionTitles = page.locator('.action-title');
    this.callLines = page.locator('.call-line');
    this.consoleLines = page.locator('.console-line');
    this.consoleLineMessages = page.locator('.console-line-message');
    this.consoleStacks = page.locator('.console-stack');
    this.stackFrames = page.locator('.stack-trace-frame');
  }

  async actionIconsText(action: string) {
    const entry = await this.page.waitForSelector(`.action-entry:has-text("${action}")`);
    await entry.waitForSelector('.action-icon-value:visible');
    return await entry.$$eval('.action-icon-value:visible', ee => ee.map(e => e.textContent));
  }

  async actionIcons(action: string) {
    return await this.page.waitForSelector(`.action-entry:has-text("${action}") .action-icons`);
  }

  async selectAction(title: string) {
    await this.page.click(`.action-title:has-text("${title}")`);
  }

  async selectSnapshot(name: string) {
    await this.page.click(`.snapshot-tab .tab-label:has-text("${name}")`);
  }

  async showConsoleTab() {
    await this.page.click('text="Console"');
  }

  async showSourceTab() {
    await this.page.click('text="Source"');
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

  async snapshotSize() {
    return this.page.$eval('.snapshot-container', e => {
      const style = window.getComputedStyle(e);
      return { width: style.width, height: style.height };
    });
  }
}

const test = playwrightTest.extend<{ showTraceViewer: (trace: string) => Promise<TraceViewerPage> }>({
  showTraceViewer: async ({ playwright, browserName, headless }, use) => {
    let browser: Browser;
    let contextImpl: any;
    await use(async (trace: string) => {
      contextImpl = await showTraceViewer(trace, browserName, headless);
      browser = await playwright.chromium.connectOverCDP({ endpointURL: contextImpl._browser.options.wsEndpoint });
      return new TraceViewerPage(browser.contexts()[0].pages()[0]);
    });
    await browser.close();
    await contextImpl._browser.close();
  }
});

let traceFile: string;

test.beforeAll(async function recordTrace({ browser, browserName, browserType }, workerInfo) {
  const context = await browser.newContext();
  await context.tracing.start({ name: 'test', screenshots: true, snapshots: true });
  const page = await context.newPage();
  await page.goto('data:text/html,<html>Hello world</html>');
  await page.setContent('<button>Click</button>');
  await page.evaluate(({ a }) => {
    console.log('Info');
    console.warn('Warning');
    console.error('Error');
    return new Promise(f => {
      // Generate exception.
      setTimeout(() => {
        // And then resolve.
        setTimeout(() => f('return ' + a), 0);
        throw new Error('Unhandled exception');
      }, 0);
    });
  }, { a: 'paramA', b: 4 });

  async function doClick() {
    await page.click('"Click"');
  }
  await doClick();

  await Promise.all([
    page.waitForNavigation(),
    page.waitForTimeout(200).then(() => page.goto('data:text/html,<html>Hello world 2</html>'))
  ]);
  await page.setViewportSize({ width: 500, height: 600 });

  // Go through instrumentation to exercise reentrant stack traces.
  (browserType as any)._onWillCloseContext = async () => {
    await page.hover('body');
    await page.close();
    traceFile = path.join(workerInfo.project.outputDir, String(workerInfo.workerIndex), browserName, 'trace.zip');
    await context.tracing.stop({ path: traceFile });
  };
  await context.close();
  (browserType as any)._onWillCloseContext = undefined;
});

test('should show empty trace viewer', async ({ showTraceViewer }, testInfo) => {
  const traceViewer = await showTraceViewer(testInfo.outputPath());
  expect(await traceViewer.page.title()).toBe('Playwright Trace Viewer');
});

test('should open simple trace viewer', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  await expect(traceViewer.actionTitles).toHaveText([
    /page.gotodata:text\/html,<html>Hello world<\/html>— \d+ms/,
    /page.setContent— \d+ms/,
    /page.evaluate— \d+ms/,
    /page.click"Click"— \d+ms/,
    /page.waitForNavigation— \d+ms/,
    /page.gotodata:text\/html,<html>Hello world 2<\/html>— \d+ms/,
    /page.setViewportSize— \d+ms/,
    /page.hoverbody— \d+ms/,
  ]);
});

test('should contain action info', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  await traceViewer.selectAction('page.click');
  const logLines = await traceViewer.callLines.allTextContents();
  expect(logLines.length).toBeGreaterThan(10);
  expect(logLines).toContain('attempting click action');
  expect(logLines).toContain('  click action done');
});

test('should render events', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  const events = await traceViewer.eventBars();
  expect(events).toContain('page_console');
});

test('should render console', async ({ showTraceViewer, browserName }) => {
  test.fixme(browserName === 'firefox', 'Firefox generates stray console message for page error');
  const traceViewer = await showTraceViewer(traceFile);
  await traceViewer.selectAction('page.evaluate');
  await traceViewer.showConsoleTab();

  await expect(traceViewer.consoleLineMessages).toHaveText(['Info', 'Warning', 'Error', 'Unhandled exception']);
  await expect(traceViewer.consoleLines).toHaveClass(['console-line log', 'console-line warning', 'console-line error', 'console-line error']);
  await expect(traceViewer.consoleStacks.first()).toContainText('Error: Unhandled exception');
});

test('should open console errors on click', async ({ showTraceViewer, browserName }) => {
  test.fixme(browserName === 'firefox', 'Firefox generates stray console message for page error');
  const traceViewer = await showTraceViewer(traceFile);
  expect(await traceViewer.actionIconsText('page.evaluate')).toEqual(['2', '1']);
  expect(await traceViewer.page.isHidden('.console-tab')).toBeTruthy();
  await (await traceViewer.actionIcons('page.evaluate')).click();
  expect(await traceViewer.page.waitForSelector('.console-tab')).toBeTruthy();
});

test('should show params and return value', async ({ showTraceViewer, browserName }) => {
  const traceViewer = await showTraceViewer(traceFile);
  await traceViewer.selectAction('page.evaluate');
  await expect(traceViewer.callLines).toHaveText([
    /page.evaluate — \d+ms/,
    'expression: "({↵    a↵  }) => {↵    console.log(\'Info\');↵    console.warn(\'Warning\');↵    con…"',
    'isFunction: true',
    'arg: {"a":"paramA","b":4}',
    'value: "return paramA"'
  ]);
});

test('should have correct snapshot size', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  await traceViewer.selectAction('page.setViewport');
  await traceViewer.selectSnapshot('Before');
  expect(await traceViewer.snapshotSize()).toEqual({ width: '1280px', height: '720px' });
  await traceViewer.selectSnapshot('After');
  expect(await traceViewer.snapshotSize()).toEqual({ width: '500px', height: '600px' });
});

test('should have correct stack trace', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);

  await traceViewer.selectAction('page.click');
  await traceViewer.showSourceTab();
  const stack1 = (await traceViewer.stackFrames.allInnerTexts()).map(s => s.replace(/\s+/g, ' ').replace(/:[0-9]+/g, ':XXX'));
  expect(stack1.slice(0, 2)).toEqual([
    'doClick trace-viewer.spec.ts :XXX',
    'recordTrace trace-viewer.spec.ts :XXX',
  ]);

  await traceViewer.selectAction('page.hover');
  await traceViewer.showSourceTab();
  const stack2 = (await traceViewer.stackFrames.allInnerTexts()).map(s => s.replace(/\s+/g, ' ').replace(/:[0-9]+/g, ':XXX'));
  expect(stack2.slice(0, 1)).toEqual([
    'BrowserType.browserType._onWillCloseContext trace-viewer.spec.ts :XXX',
  ]);
});
