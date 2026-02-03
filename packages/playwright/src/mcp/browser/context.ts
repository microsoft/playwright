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

import { debug } from 'playwright-core/lib/utilsBundle';
import { escapeWithQuotes } from 'playwright-core/lib/utils';
import { selectors } from 'playwright-core';
import { fileURLToPath } from 'url';

import { logUnhandledError } from '../log';
import { Tab } from './tab';
import { outputFile, workspaceFile } from './config';

import type * as playwright from '../../../types/test';
import type { FullConfig } from './config';
import type { BrowserContextFactory, BrowserContextFactoryResult } from './browserContextFactory';
import type { SessionLog } from './sessionLog';
import type { Tracing } from '../../../../playwright-core/src/client/tracing';
import type { ClientInfo } from '../sdk/server';

const testDebug = debug('pw:mcp:test');

type ContextOptions = {
  config: FullConfig;
  browserContextFactory: BrowserContextFactory;
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

export class Context {
  readonly config: FullConfig;
  readonly sessionLog: SessionLog | undefined;
  readonly options: ContextOptions;
  private _browserContextPromise: Promise<BrowserContextFactoryResult> | undefined;
  private _browserContextFactory: BrowserContextFactory;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _clientInfo: ClientInfo;
  private _routes: RouteEntry[] = [];

  private static _allContexts: Set<Context> = new Set();
  private _closeBrowserContextPromise: Promise<void> | undefined;
  private _runningToolName: string | undefined;
  private _abortController = new AbortController();

  onBrowserContextClosed: (() => void) | undefined;
  onBrowserLaunchFailed: ((error: Error) => void) | undefined;

  constructor(options: ContextOptions) {
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this.options = options;
    this._browserContextFactory = options.browserContextFactory;
    this._clientInfo = options.clientInfo;
    testDebug('create context');
    Context._allContexts.add(this);
  }

  static async disposeAll() {
    await Promise.all([...Context._allContexts].map(context => context.dispose()));
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
    const { browserContext } = await this._ensureBrowserContext();
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
    const { browserContext } = await this._ensureBrowserContext();
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

  private _onPageCreated(page: playwright.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
  }

  private _onPageClosed(tab: Tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);

    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
    if (!this._tabs.length)
      void this.closeBrowserContext();
  }

  async closeBrowserContext() {
    if (!this._closeBrowserContextPromise)
      this._closeBrowserContextPromise = this._closeBrowserContextImpl().catch(logUnhandledError);
    await this._closeBrowserContextPromise;
    this._closeBrowserContextPromise = undefined;
  }

  routes(): RouteEntry[] {
    return this._routes;
  }

  async addRoute(entry: RouteEntry): Promise<void> {
    const { browserContext } = await this._ensureBrowserContext();
    await browserContext.route(entry.pattern, entry.handler);
    this._routes.push(entry);
  }

  async removeRoute(pattern?: string): Promise<number> {
    if (!this._browserContextPromise)
      return 0;
    const { browserContext } = await this._browserContextPromise;
    let removed = 0;
    if (pattern) {
      const toRemove = this._routes.filter(r => r.pattern === pattern);
      for (const route of toRemove)
        await browserContext.unroute(route.pattern, route.handler);
      this._routes = this._routes.filter(r => r.pattern !== pattern);
      removed = toRemove.length;
    } else {
      for (const route of this._routes)
        await browserContext.unroute(route.pattern, route.handler);
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

  private async _closeBrowserContextImpl() {
    if (!this._browserContextPromise)
      return;

    testDebug('close context');

    const promise = this._browserContextPromise;
    this._browserContextPromise = undefined;

    await promise.then(async ({ browserContext, close }) => {
      if (this.config.saveTrace)
        await browserContext.tracing.stop();
      await close();
    });
  }

  async dispose() {
    this._abortController.abort('MCP context disposed');
    await this.closeBrowserContext();
    Context._allContexts.delete(this);
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
    const { browserContext } = await this._ensureBrowserContext();
    return browserContext;
  }

  private _ensureBrowserContext() {
    if (this._browserContextPromise)
      return this._browserContextPromise;

    this._browserContextPromise = this._setupBrowserContext();
    this._browserContextPromise.catch(error => {
      this._browserContextPromise = undefined;
      this.onBrowserLaunchFailed?.(error);
    });
    return this._browserContextPromise;
  }

  private async _setupBrowserContext(): Promise<BrowserContextFactoryResult> {
    if (this._closeBrowserContextPromise)
      throw new Error('Another browser context is being closed.');
    // TODO: move to the browser context factory to make it based on isolation mode.

    if (this.config.testIdAttribute)
      selectors.setTestIdAttribute(this.config.testIdAttribute);
    const result = await this._browserContextFactory.createContext(this._clientInfo, this._abortController.signal, { toolName: this._runningToolName });
    const { browserContext } = result;
    if (!this.config.allowUnrestrictedFileAccess) {
      (browserContext as any)._setAllowedProtocols(['http:', 'https:', 'about:', 'data:']);
      (browserContext as any)._setAllowedDirectories(allRootPaths(this._clientInfo));
    }
    await this._setupRequestInterception(browserContext);
    for (const page of browserContext.pages())
      this._onPageCreated(page);
    browserContext.on('page', page => this._onPageCreated(page));
    browserContext.on('close', () => this.onBrowserContextClosed?.());
    if (this.config.saveTrace) {
      await (browserContext.tracing as Tracing).start({
        name: 'trace-' + Date.now(),
        screenshots: true,
        snapshots: true,
        _live: true,
      });
    }
    return result;
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
