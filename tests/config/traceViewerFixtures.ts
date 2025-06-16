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

import type { Fixtures, FrameLocator, Locator, Page, Browser, BrowserContext } from '@playwright/test';
import { step } from './baseTest';
import { runTraceViewerApp } from '../../packages/playwright-core/lib/server';

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
  runAndTrace: (body: () => Promise<void>, optsOverrides?: Parameters<BrowserContext['tracing']['start']>[0]) => Promise<TraceViewerPage>;
};

class TraceViewerPage {
  actionTitles: Locator;
  actionsTree: Locator;
  callLines: Locator;
  consoleLines: Locator;
  logLines: Locator;
  errorMessages: Locator;
  consoleLineMessages: Locator;
  consoleStacks: Locator;
  networkRequests: Locator;
  metadataTab: Locator;
  snapshotContainer: Locator;
  sourceCodeTab: Locator;

  settingsDialog: Locator;
  darkModeSetting: Locator;
  displayCanvasContentSetting: Locator;

  constructor(public page: Page) {
    this.actionTitles = page.locator('.action-title');
    this.actionsTree = page.getByTestId('actions-tree');
    this.callLines = page.locator('.call-tab .call-line');
    this.logLines = page.getByRole('list', { name: 'Log entries' }).getByRole('listitem');
    this.consoleLines = page.getByRole('tabpanel', { name: 'Console' }).getByRole('listitem');
    this.consoleLineMessages = page.locator('.console-line-message');
    this.errorMessages = page.locator('.error-message');
    this.consoleStacks = page.locator('.console-stack');
    this.networkRequests = page.getByRole('list', { name: 'Network requests' }).getByRole('listitem');
    this.snapshotContainer = page.locator('.snapshot-container iframe.snapshot-visible[name=snapshot]');
    this.metadataTab = page.getByRole('tabpanel', { name: 'Metadata' });
    this.sourceCodeTab = page.getByRole('tabpanel', { name: 'Source' });

    this.settingsDialog = page.getByTestId('settings-toolbar-dialog');
    this.darkModeSetting = page.locator('.setting').getByText('Dark mode');
    this.displayCanvasContentSetting = page.locator('.setting').getByText('Display canvas content');
  }

  stackFrames(options: { selected?: boolean } = {}) {
    const entry = this.page.getByRole('list', { name: 'Stack trace' }).getByRole('listitem');
    if (options.selected)
      return entry.locator(':scope.selected');
    return entry;
  }

  actionIconsText(action: string) {
    const entry = this.actionsTree.getByRole('treeitem', { name: action });
    return entry.locator('.action-icon-value').filter({ visible: true });
  }

  actionIcons(action: string) {
    return this.actionsTree.getByRole('treeitem', { name: action }).locator('.action-icons').filter({ visible: true });
  }

  @step
  async expandAction(title: string) {
    await this.actionsTree.getByRole('treeitem', { name: title }).locator('.codicon-chevron-right').click();
  }

  @step
  async selectAction(title: string, ordinal: number = 0) {
    await this.actionsTree.getByTitle(title).nth(ordinal).click();
  }

  @step
  async hoverAction(title: string, ordinal: number = 0) {
    await this.actionsTree.getByRole('treeitem', { name: title }).nth(ordinal).hover();
  }

  @step
  async selectSnapshot(name: string) {
    await this.page.getByRole('tab', { name }).click();
  }

  async showErrorsTab() {
    await this.page.getByRole('tab', { name: 'Errors' }).click();
  }

  async showConsoleTab() {
    await this.page.getByRole('tab', { name: 'Console' }).click();
  }

  async showSourceTab() {
    await this.page.getByRole('tab', { name: 'Source' }).click();
  }

  async showNetworkTab() {
    await this.page.getByRole('tab', { name: 'Network' }).click();
  }

  async showMetadataTab() {
    await this.page.getByRole('tab', { name: 'Metadata' }).click();
  }

  async showSettings() {
    await this.page.getByRole('button', { name: 'Settings' }).click();
  }

  @step
  async snapshotFrame(actionName: string, ordinal: number = 0, hasSubframe: boolean = false): Promise<FrameLocator> {
    await this.selectAction(actionName, ordinal);
    while (this.page.frames().length < (hasSubframe ? 4 : 3))
      await this.page.waitForEvent('frameattached');
    return this.page.frameLocator('iframe.snapshot-visible[name=snapshot]');
  }
}

export const traceViewerFixtures: Fixtures<TraceViewerFixtures, {}, BaseTestFixtures, BaseWorkerFixtures> = {
  showTraceViewer: async ({ playwright, browserName, headless }, use, testInfo) => {
    const browsers: Browser[] = [];
    const contextImpls: any[] = [];
    await use(async (traces: string[], { host, port } = {}) => {
      const pageImpl = await runTraceViewerApp(traces, browserName, { headless, host, port });
      const contextImpl = pageImpl.browserContext;
      const browser = await playwright.chromium.connectOverCDP(contextImpl._browser.options.wsEndpoint);
      browsers.push(browser);
      contextImpls.push(contextImpl);
      return new TraceViewerPage(browser.contexts()[0].pages()[0]);
    });
    for (const browser of browsers)
      await browser.close();
    for (const contextImpl of contextImpls)
      await contextImpl._browser.close({ reason: 'Trace viewer closed' });
  },

  runAndTrace: async ({ context, showTraceViewer }, use, testInfo) => {
    await use(async (body: () => Promise<void>, optsOverrides = {}) => {
      const traceFile = testInfo.outputPath('trace.zip');
      await context.tracing.start({ snapshots: true, screenshots: true, sources: true, ...optsOverrides });
      await body();
      await context.tracing.stop({ path: traceFile });
      return showTraceViewer([traceFile]);
    });
  },
};
