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

import type { Fixtures, Frame, Locator, Page, Browser, BrowserContext } from '@playwright/test';
import { showTraceViewer } from '../../packages/playwright-core/lib/server/trace/viewer/traceViewer';

type BaseTestFixtures = {
  context: BrowserContext;
};

type BaseWorkerFixtures = {
  headless: boolean;
  browser: Browser;
  browserName: 'chromium' | 'firefox' | 'webkit';
  playwright: typeof import('@playwright/test');
};

export type TraceViewerFixtures = {
  showTraceViewer: (trace: string[], options?: {host?: string, port?: number}) => Promise<TraceViewerPage>;
  runAndTrace: (body: () => Promise<void>) => Promise<TraceViewerPage>;
};

class TraceViewerPage {
  actionTitles: Locator;
  callLines: Locator;
  consoleLines: Locator;
  consoleLineMessages: Locator;
  consoleStacks: Locator;
  stackFrames: Locator;
  networkRequests: Locator;
  snapshotContainer: Locator;

  constructor(public page: Page) {
    this.actionTitles = page.locator('.action-title');
    this.callLines = page.locator('.call-line');
    this.consoleLines = page.locator('.console-line');
    this.consoleLineMessages = page.locator('.console-line-message');
    this.consoleStacks = page.locator('.console-stack');
    this.stackFrames = page.getByTestId('stack-trace').locator('.list-view-entry');
    this.networkRequests = page.locator('.network-request-title');
    this.snapshotContainer = page.locator('.snapshot-container iframe');
  }

  async actionIconsText(action: string) {
    const entry = await this.page.waitForSelector(`.list-view-entry:has-text("${action}")`);
    await entry.waitForSelector('.action-icon-value:visible');
    return await entry.$$eval('.action-icon-value:visible', ee => ee.map(e => e.textContent));
  }

  async actionIcons(action: string) {
    return await this.page.waitForSelector(`.list-view-entry:has-text("${action}") .action-icons`);
  }

  async selectAction(title: string, ordinal: number = 0) {
    await this.page.locator(`.action-title:has-text("${title}")`).nth(ordinal).click();
  }

  async selectSnapshot(name: string) {
    await this.page.click(`.snapshot-tab .tabbed-pane-tab-label:has-text("${name}")`);
  }

  async showConsoleTab() {
    await this.page.click('text="Console"');
  }

  async showSourceTab() {
    await this.page.click('text="Source"');
  }

  async showNetworkTab() {
    await this.page.click('text="Network"');
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

  async snapshotFrame(actionName: string, ordinal: number = 0, hasSubframe: boolean = false): Promise<Frame> {
    const existing = this.page.mainFrame().childFrames()[0];
    await Promise.all([
      existing ? existing.waitForNavigation() as any : Promise.resolve(),
      this.selectAction(actionName, ordinal),
    ]);
    while (this.page.frames().length < (hasSubframe ? 3 : 2))
      await this.page.waitForEvent('frameattached');
    return this.page.mainFrame().childFrames()[0];
  }
}

export const traceViewerFixtures: Fixtures<TraceViewerFixtures, {}, BaseTestFixtures, BaseWorkerFixtures> = {
  showTraceViewer: async ({ playwright, browserName, headless }, use) => {
    const browsers: Browser[] = [];
    const contextImpls: any[] = [];
    await use(async (traces: string[], { host, port } = {}) => {
      const contextImpl = await showTraceViewer(traces, browserName, { headless, host, port });
      const browser = await playwright.chromium.connectOverCDP(contextImpl._browser.options.wsEndpoint);
      browsers.push(browser);
      contextImpls.push(contextImpl);
      return new TraceViewerPage(browser.contexts()[0].pages()[0]);
    });
    for (const browser of browsers)
      await browser.close();
    for (const contextImpl of contextImpls)
      await contextImpl._browser.close();
  },

  runAndTrace: async ({ context, showTraceViewer }, use, testInfo) => {
    await use(async (body: () => Promise<void>) => {
      const traceFile = testInfo.outputPath('trace.zip');
      await context.tracing.start({ snapshots: true, screenshots: true, sources: true });
      await body();
      await context.tracing.stop({ path: traceFile });
      return showTraceViewer([traceFile]);
    });
  },
};
