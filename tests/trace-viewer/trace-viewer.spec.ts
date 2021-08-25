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
import type { Browser, Page } from '../../index';
import { showTraceViewer } from '../../lib/server/trace/viewer/traceViewer';
import { playwrightTest } from '../config/browserTest';
import { expect } from '../config/test-runner';

class TraceViewerPage {
  constructor(public page: Page) {}

  async actionTitles() {
    await this.page.waitForSelector('.action-title:visible');
    return await this.page.$$eval('.action-title:visible', ee => ee.map(e => e.textContent));
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

  async callLines() {
    await this.page.waitForSelector('.call-line:visible');
    return await this.page.$$eval('.call-line:visible', ee => ee.map(e => e.textContent));
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

  async consoleLines() {
    await this.page.waitForSelector('.console-line-message:visible');
    return await this.page.$$eval('.console-line-message:visible', ee => ee.map(e => e.textContent));
  }

  async consoleLineTypes() {
    await this.page.waitForSelector('.console-line-message:visible');
    return await this.page.$$eval('.console-line:visible', ee => ee.map(e => e.className));
  }

  async consoleStacks() {
    await this.page.waitForSelector('.console-stack:visible');
    return await this.page.$$eval('.console-stack:visible', ee => ee.map(e => e.textContent));
  }

  async sourceStack() {
    await this.page.waitForSelector('.stack-trace-frame:visible');
    return await this.page.$$eval('.stack-trace-frame:visible', ee => ee.map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ')));
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
    setTimeout(() => { throw new Error('Unhandled exception'); }, 0);
    return 'return ' + a;
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
    traceFile = path.join(workerInfo.project.outputDir, browserName, 'trace.zip');
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
  expect(await traceViewer.actionTitles()).toEqual([
    'page.gotodata:text/html,<html>Hello world</html>',
    'page.setContent',
    'page.evaluate',
    'page.click\"Click\"',
    'page.waitForNavigation',
    'page.gotodata:text/html,<html>Hello world 2</html>',
    'page.setViewportSize',
    'page.hoverbody',
  ]);
});

test('should contain action info', async ({ showTraceViewer }) => {
  const traceViewer = await showTraceViewer(traceFile);
  await traceViewer.selectAction('page.click');
  const logLines = await traceViewer.callLines();
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

  const events = await traceViewer.consoleLines();
  expect(events).toEqual(['Info', 'Warning', 'Error', 'Unhandled exception']);
  const types = await traceViewer.consoleLineTypes();
  expect(types).toEqual(['console-line log', 'console-line warning', 'console-line error', 'console-line error']);
  const stacks = await traceViewer.consoleStacks();
  expect(stacks.length).toBe(1);
  expect(stacks[0]).toContain('Error: Unhandled exception');
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
  expect(await traceViewer.callLines()).toEqual([
    'page.evaluate',
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
  const stack1 = await traceViewer.sourceStack();
  expect(stack1.slice(0, 2)).toEqual([
    'doClick trace-viewer.spec.ts :133',
    'recordTrace trace-viewer.spec.ts :135',
  ]);

  await traceViewer.selectAction('page.hover');
  await traceViewer.showSourceTab();
  const stack2 = await traceViewer.sourceStack();
  expect(stack2.slice(0, 1)).toEqual([
    'BrowserType.browserType._onWillCloseContext trace-viewer.spec.ts :145',
  ]);
});
