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

import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { eventsHelper } from '../../client/eventEmitter';
import { debug } from '../../utilsBundle';
import { escapeWithQuotes } from '../../utils/isomorphic/stringUtils';
import { selectors } from '../../..';

import { Tab } from './tab';
import { outputFile, workspaceFile } from './config';

import type * as playwright from '../../..';
import type { FullConfig } from './config';
import type { SessionLog } from './sessionLog';
import type { Tracing } from '../../client/tracing';
import type { RegisteredListener } from '../../client/eventEmitter';
import type { ClientInfo } from '../sdk/server';
import type { BrowserContext } from '../../client/browserContext';

const testDebug = debug('pw:mcp:test');

type ContextOptions = {
  config: FullConfig;
  sessionLog: SessionLog | undefined;
  clientInfo: ClientInfo;
};

export type RouteEntry = {
  pattern: string;
  status?: number;
  body?: string;
  contentType?: string;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  handler: (route: playwright.Route) => Promise<void>;
};

export type FilenameTemplate = {
  prefix: string;
  ext: string;
  suggestedFilename?: string;
  date?: Date;
};

type VideoParams = NonNullable<Parameters<playwright.Video['start']>[0]>;

export class Context {
  readonly config: FullConfig;
  readonly sessionLog: SessionLog | undefined;
  readonly options: ContextOptions;
  private _rawBrowserContext: playwright.BrowserContext;
  private _browserContextPromise: Promise<playwright.BrowserContext> | undefined;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _clientInfo: ClientInfo;
  private _routes: RouteEntry[] = [];
  private _video: {
    allVideos: Set<playwright.Video>;
    params: VideoParams;
  } | undefined;
  private _listeners: RegisteredListener[] = [];

  private _runningToolName: string | undefined;

  constructor(browserContext: playwright.BrowserContext, options: ContextOptions) {
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this.options = options;
    this._rawBrowserContext = browserContext;
    this._clientInfo = options.clientInfo;
    testDebug('create context');
  }

  dispose() {
    eventsHelper.removeEventListeners(this._listeners);
    for (const tab of this._tabs)
      tab.dispose();
    this._tabs.length = 0;
    this._currentTab = undefined;
    this._video = undefined;
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  currentTab(): Tab | undefined {
    return this._currentTab;
  }

  currentTabOrDie(): Tab {
    if (!this._currentTab)
      throw new Error('No open pages available.');
    return this._currentTab;
  }

  async newTab(): Promise<Tab> {
    const browserContext = await this.ensureBrowserContext();
    const page = await browserContext.newPage();
    this._currentTab = this._tabs.find(t => t.page === page)!;
    return this._currentTab;
  }

  async selectTab(index: number) {
    const tab = this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    await tab.page.bringToFront();
    this._currentTab = tab;
    return tab;
  }

  async ensureTab(): Promise<Tab> {
    const browserContext = await this.ensureBrowserContext();
    if (!this._currentTab)
      await browserContext.newPage();
    return this._currentTab!;
  }

  async closeTab(index: number | undefined): Promise<string> {
    const tab = index === undefined ? this._currentTab : this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    const url = tab.page.url();
    await tab.page.close();
    return url;
  }

  async workspaceFile(fileName: string, perCallWorkspaceDir: string | undefined): Promise<string> {
    return await workspaceFile(this.config, this._clientInfo, fileName, perCallWorkspaceDir);
  }

  async outputFile(template: FilenameTemplate, options: { origin: 'code' | 'llm' }): Promise<string> {
    const baseName = template.suggestedFilename || `${template.prefix}-${(template.date ?? new Date()).toISOString().replace(/[:.]/g, '-')}${template.ext ? '.' + template.ext : ''}`;
    return await outputFile(this.config, this._clientInfo, baseName, options);
  }

  async startVideoRecording(params: VideoParams) {
    if (this._video)
      throw new Error('Video recording has already been started.');
    this._video = { allVideos: new Set(), params };
    const browserContext = await this.ensureBrowserContext();
    for (const page of browserContext.pages())
      this._startPageVideo(page);
  }

  async stopVideoRecording() {
    if (!this._video)
      throw new Error('Video recording has not been started.');
    const video = this._video;
    for (const page of this._rawBrowserContext.pages())
      await page.video().stop().catch(() => {});
    this._video = undefined;
    return video.allVideos;
  }

  private _startPageVideo(page: playwright.Page) {
    if (!this._video)
      return;
    this._video.allVideos.add(page.video());
    page.video().start(this._video.params).catch(() => {});
  }

  private _onPageCreated(page: playwright.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
    this._startPageVideo(page);
  }

  private _onPageClosed(tab: Tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);

    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
  }

  routes(): RouteEntry[] {
    return this._routes;
  }

  async addRoute(entry: RouteEntry): Promise<void> {
    const browserContext = await this.ensureBrowserContext();
    await browserContext.route(entry.pattern, entry.handler);
    this._routes.push(entry);
  }

  async removeRoute(pattern?: string): Promise<number> {
    let removed = 0;
    if (pattern) {
      const toRemove = this._routes.filter(r => r.pattern === pattern);
      for (const route of toRemove)
        await this._rawBrowserContext.unroute(route.pattern, route.handler);
      this._routes = this._routes.filter(r => r.pattern !== pattern);
      removed = toRemove.length;
    } else {
      for (const route of this._routes)
        await this._rawBrowserContext.unroute(route.pattern, route.handler);
      removed = this._routes.length;
      this._routes = [];
    }
    return removed;
  }

  isRunningTool() {
    return this._runningToolName !== undefined;
  }

  setRunningTool(name: string | undefined) {
    this._runningToolName = name;
  }

  private async _setupRequestInterception(context: playwright.BrowserContext) {
    if (this.config.network?.allowedOrigins?.length) {
      await context.route('**', route => route.abort('blockedbyclient'));

      for (const origin of this.config.network.allowedOrigins)
        await context.route(originOrHostGlob(origin), route => route.continue());
    }

    if (this.config.network?.blockedOrigins?.length) {
      for (const origin of this.config.network.blockedOrigins)
        await context.route(originOrHostGlob(origin), route => route.abort('blockedbyclient'));
    }
  }

  async ensureBrowserContext(): Promise<playwright.BrowserContext> {
    if (this._browserContextPromise)
      return this._browserContextPromise;
    this._browserContextPromise = this._initializeBrowserContext();
    return this._browserContextPromise;
  }

  private async _initializeBrowserContext() {
    if (this.config.testIdAttribute)
      selectors.setTestIdAttribute(this.config.testIdAttribute);
    const browserContext = this._rawBrowserContext;
    if (!this.config.allowUnrestrictedFileAccess) {
      (browserContext as any)._setAllowedProtocols(['http:', 'https:', 'about:', 'data:']);
      (browserContext as any)._setAllowedDirectories(allRootPaths(this._clientInfo));
    }
    await this._setupRequestInterception(browserContext);
    for (const page of browserContext.pages())
      this._onPageCreated(page);
    this._listeners.push(eventsHelper.addEventListener(browserContext as BrowserContext, 'page', page => this._onPageCreated(page)));
    if (this.config.saveTrace) {
      await (browserContext.tracing as Tracing).start({
        name: 'trace-' + Date.now(),
        screenshots: true,
        snapshots: true,
        _live: true,
      });
    }
    const rootPath = this.firstRootPath();
    for (const initScript of this.config.browser.initScript || [])
      await browserContext.addInitScript({ path: rootPath ? path.resolve(rootPath, initScript) : initScript });
    return browserContext;
  }

  lookupSecret(secretName: string): { value: string, code: string } {
    if (!this.config.secrets?.[secretName])
      return { value: secretName, code: escapeWithQuotes(secretName, '\'') };
    return {
      value: this.config.secrets[secretName]!,
      code: `process.env['${secretName}']`,
    };
  }

  firstRootPath(): string | undefined {
    return allRootPaths(this._clientInfo)[0];
  }
}

function allRootPaths(clientInfo: ClientInfo): string[] {
  const paths: string[] = [];
  for (const root of clientInfo.roots) {
    const url = new URL(root.uri);
    let rootPath;
    try {
      rootPath = fileURLToPath(url);
    } catch (e) {
      // Support WSL paths on Windows.
      if (e.code === 'ERR_INVALID_FILE_URL_PATH' && os.platform() === 'win32')
        rootPath = decodeURIComponent(url.pathname);
    }
    if (!rootPath)
      continue;
    paths.push(rootPath);
  }
  if (paths.length === 0)
    paths.push(process.cwd());
  return paths;
}


function originOrHostGlob(originOrHost: string) {
  // Support wildcard port patterns like "http://localhost:*" or "https://example.com:*"
  const wildcardPortMatch = originOrHost.match(/^(https?:\/\/[^/:]+):\*$/);
  if (wildcardPortMatch)
    return `${wildcardPortMatch[1]}:*/**`;

  try {
    const url = new URL(originOrHost);
    // localhost:1234 will parse as protocol 'localhost:' and 'null' origin.
    if (url.origin !== 'null')
      return `${url.origin}/**`;
  } catch {
  }
  // Support for legacy host-only mode.
  return `*://${originOrHost}/**`;
}
