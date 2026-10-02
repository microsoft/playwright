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

import fs from 'fs';
import os from 'os';
import path from 'path';

import debug from 'debug';
import { escapeWithQuotes } from '@isomorphic/stringUtils';
import { disposeAll } from '@isomorphic/disposable';
import { eventsHelper } from '@utils/eventsHelper';
import { isPathInside, isSystemDirectory, isWritable, resolveSymlinks, sanitizeForFilePath } from '@utils/fileUtils';
import { playwright } from '../../inprocess';

import { dedent, languageGeneratorId, secretCode } from './codegen';
import { Tab } from './tab';

import type { BrowserContextEx } from './browserContextEx';
import type { CodegenLanguage } from './codegen';
import type * as playwrightTypes from '../../..';
import type { SessionLog } from './sessionLog';
import type { Disposable } from '@isomorphic/disposable';
import type { ToolCapability } from './tool';
import type { WebMCPToolDefinition } from './webmcp';

const testDebug = debug('pw:mcp:test');

export type ContextConfig = {
  allowUnrestrictedFileAccess?: boolean;
  capabilities?: ToolCapability[];
  codegen?: 'typescript' | 'python' | 'java' | 'csharp' | 'none';
  console?: { level?: 'error' | 'warning' | 'info' | 'debug' };
  imageResponses?: 'allow' | 'omit' | 'only';
  filePaths?: 'relative' | 'absolute';
  network?: {
    allowedOrigins?: string[];
    blockedOrigins?: string[];
  };
  outputDir?: string;
  outputMaxSize?: number;
  saveSession?: boolean;
  secrets?: Record<string, string>;
  sharedBrowserContext?: boolean;
  snapshot?: {
    mode?: 'full' | 'none';
    boxes?: boolean;
  };
  testIdAttribute?: string;
  webmcp?: boolean;
  timeouts?: {
    action?: number;
    navigation?: number;
    expect?: number;
    settle?: number;
  };
  browser?: {
    contextOptions?: playwrightTypes.BrowserContextOptions;
    initScript?: string[];
    initPage?: string[];
  };
  skillMode?: boolean;
};

type ContextOptions = {
  config: ContextConfig;
  sessionLog?: SessionLog;
  cwd: string;
  onWebMCPToolsChanged?: () => void;
};

export type RouteEntry = {
  pattern: string;
  status?: number;
  body?: string;
  contentType?: string;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  handler: (route: playwrightTypes.Route) => Promise<void>;
};

export type FilenameTemplate = {
  prefix: string;
  ext: string;
  suggestedFilename?: string;
  date?: Date;
};

type VideoParams = { size?: { width: number; height: number }, fps?: number, cursor?: boolean };

export type TraceInfo = { name: string, isolatedContext?: string };

// Actions are paced by this delay when the cursor is shown, giving it time to travel.
const kCursorDuration = 800;

export class Context {
  readonly config: ContextConfig;
  readonly sessionLog: SessionLog | undefined;
  readonly options: ContextOptions;
  private _defaultBrowserContext: playwrightTypes.BrowserContext;
  // Keyed by isolated context name, undefined for the default context.
  // Resolves once the context exists and has routes, init scripts and page listeners installed.
  private _browserContexts = new Map<string | undefined, Promise<playwrightTypes.BrowserContext>>();
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _routes: RouteEntry[] = [];
  private _video: {
    params: VideoParams;
    fileNames: string[];
    fileName: string;
  } | undefined;
  private _recording: {
    browserContext: playwrightTypes.BrowserContext;
    actions: string[];
  } | undefined;
  private _tracing: {
    name: string;
    traces: (TraceInfo & { browserContext: playwrightTypes.BrowserContext })[];
  } | undefined;
  private _disposables: Disposable[] = [];

  private _webmcpToolsSignature = '';

  private _runningToolName: string | undefined;
  private _pendingUnhandledRejections: unknown[] = [];
  private _unhandledRejectionListeners = new Set<(reason: unknown) => void>();
  private _onUnhandledRejection = (reason: unknown) => {
    this._pendingUnhandledRejections.push(reason);
    for (const listener of this._unhandledRejectionListeners)
      listener(reason);
  };

  constructor(browserContext: playwrightTypes.BrowserContext, options: ContextOptions) {
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this.options = options;
    this._defaultBrowserContext = browserContext;
    if (this.config.testIdAttribute)
      playwright.selectors.setTestIdAttribute(this.config.testIdAttribute);
    testDebug('create context');
    process.on('unhandledRejection', this._onUnhandledRejection);
  }

  async dispose() {
    process.off('unhandledRejection', this._onUnhandledRejection);
    await this.stopRecording();
    await this.stopVideoRecording();
    await disposeAll(this._disposables);
    for (const tab of this._tabs)
      await tab.dispose();
    this._tabs.length = 0;
    this._setCurrentTab(undefined);
    await Promise.all([...this._browserContexts].filter(([isolatedContext]) => isolatedContext).map(([, browserContext]) => browserContext.then(c => c.close()).catch(() => {})));
    this._browserContexts.clear();
  }

  drainPendingUnhandledRejections(): unknown[] {
    const reasons = this._pendingUnhandledRejections.slice();
    this._pendingUnhandledRejections.length = 0;
    return reasons;
  }

  onUnhandledRejection(listener: (reason: unknown) => void): () => void {
    this._unhandledRejectionListeners.add(listener);
    return () => this._unhandledRejectionListeners.delete(listener);
  }

  debugger() {
    return this._defaultBrowserContext.debugger;
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

  async newTab(isolatedContext?: string): Promise<Tab> {
    const browserContext = await this.ensureBrowserContext(isolatedContext);
    const page = await browserContext.newPage();
    this._setCurrentTab(this._tabs.find(t => t.page === page)!);
    return this._currentTab!;
  }

  async selectTab(index: number) {
    const tab = this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    await tab.page.bringToFront();
    await tab.updateWebMCPTools();
    this._setCurrentTab(tab);
    return tab;
  }

  async ensureTab(): Promise<Tab> {
    await this.ensureBrowserContext();
    const crashed = this._currentTab?.crashed;
    if (crashed) {
      await this._currentTab!.page.close().catch(() => {});
      this._setCurrentTab(undefined);
    }
    if (!this._currentTab)
      await this.newTab();
    if (crashed)
      this._currentTab!.logErrorMessage('Page crashed and was reset to about:blank.');
    await this._currentTab!.waitForInitialized();
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
    return await workspaceFile(this.options, fileName, perCallWorkspaceDir);
  }

  async outputFile(template: FilenameTemplate, options: { origin: 'code' | 'llm' }): Promise<string> {
    const baseName = template.suggestedFilename || `${template.prefix}-${(template.date ?? new Date()).toISOString().replace(/[:.]/g, '-')}${template.ext ? '.' + template.ext : ''}`;
    return await outputFile(this.options, baseName, options);
  }

  async startVideoRecording(fileName: string, params: VideoParams) {
    if (this._video)
      throw new Error('Video recording has already been started.');
    await this.ensureBrowserContext();
    this._video = { params, fileName, fileNames: [] };
    for (const tab of this._tabs)
      await this._startPageVideo(tab.page);
  }

  async stopVideoRecording(): Promise<string[]> {
    if (!this._video)
      return [];
    const video = this._video;
    for (const tab of this._tabs)
      await tab.page.screencast.stop();
    this._video = undefined;
    return [...video.fileNames];
  }

  async startRecording() {
    if (this._recording)
      throw new Error('Recording is already in progress.');
    const browserContext = await this.currentBrowserContext() as BrowserContextEx;
    if (typeof browserContext._startRecording !== 'function')
      throw new Error('Recording requires a newer version of Playwright, please upgrade.');
    const recordedActions: string[] = [];
    await browserContext._startRecording({
      language: languageGeneratorId(this.codegenLanguage()),
    }, {
      actionAdded: (page, action, code) => {
        recordedActions.push(code);
      },
      actionUpdated: (page, action, code) => {
        if (recordedActions.length)
          recordedActions[recordedActions.length - 1] = code;
        else
          recordedActions.push(code);
      },
      signalAdded: (page, signal, code) => {
        if (recordedActions.length && code)
          recordedActions[recordedActions.length - 1] = code;
      },
    });
    this._recording = { browserContext, actions: recordedActions };
  }

  async stopRecording(): Promise<string[] | undefined> {
    const recording = this._recording;
    if (!recording)
      return undefined;
    this._recording = undefined;
    await (recording.browserContext as BrowserContextEx)._stopRecording();
    return recording.actions.filter(code => code.trim()).map(dedent);
  }

  async startTracing(): Promise<TraceInfo[]> {
    if (this._tracing)
      throw new Error('Tracing has already been started.');
    await this.ensureBrowserContext();
    const tracing = this._tracing = { name: 'trace-' + Date.now(), traces: [] };
    for (const [isolatedContext, browserContext] of this._browserContexts)
      await this._startContextTracing(isolatedContext, await browserContext);
    return tracing.traces;
  }

  async stopTracing(): Promise<TraceInfo[] | undefined> {
    const tracing = this._tracing;
    if (!tracing)
      return undefined;
    this._tracing = undefined;
    await Promise.all(tracing.traces.filter(trace => !trace.browserContext.isClosed()).map(trace => trace.browserContext.tracing.stop()));
    return tracing.traces;
  }

  private async _startContextTracing(isolatedContext: string | undefined, browserContext: playwrightTypes.BrowserContext) {
    const tracing = this._tracing;
    if (!tracing || tracing.traces.some(trace => trace.browserContext === browserContext))
      return;
    let name = isolatedContext ? `${tracing.name}-${sanitizeForFilePath(isolatedContext)}` : tracing.name;
    if (tracing.traces.some(trace => trace.name === name))
      name += `-${tracing.traces.length}`;
    tracing.traces.push({ name, isolatedContext, browserContext });
    await browserContext.tracing.start({ name, screenshots: true, snapshots: true, live: true });
  }

  codegenLanguage(): CodegenLanguage {
    const codegen = this.config.codegen ?? 'typescript';
    return codegen === 'none' ? 'typescript' : codegen;
  }

  private async _startPageVideo(page: playwrightTypes.Page) {
    if (!this._video)
      return;
    const suffix = this._video.fileNames.length ? `-${this._video.fileNames.length}` : '';
    let fileName = this._video.fileName;
    if (fileName && suffix) {
      const dir = path.dirname(fileName);
      const ext = path.extname(fileName);
      fileName = path.join(dir, path.basename(fileName, ext) + suffix + ext);
    }
    this._video.fileNames.push(fileName);
    const { cursor, ...startParams } = this._video.params;
    await page.screencast.start({ path: fileName, ...startParams });
    if (cursor) {
      // Show the cursor only, the action title is what `browser_video_show_actions` is for.
      await page.screencast.showActions({ cursor: 'pointer', duration: kCursorDuration, style: { title: 'display: none' } });
    }
  }

  private _onPageCreated(page: playwrightTypes.Page, isolatedContext: string | undefined) {
    const tab = new Tab(this, page, isolatedContext, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._setCurrentTab(tab);
    this._startPageVideo(page).catch(() => {});
  }

  private _onPageClosed(tab: Tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);

    if (this._currentTab === tab)
      this._setCurrentTab(this._tabs[Math.min(index, this._tabs.length - 1)]);
  }

  currentWebMCPTools(): WebMCPToolDefinition[] {
    // Handlers are bound to a tab and frame, always take the fresh ones.
    return this._currentTab?.webmcpTools()?.tools.map(tool => tool.mcpTool) ?? [];
  }

  maybeNotifyWebMCPToolsChanged() {
    const signature = JSON.stringify(this.currentWebMCPTools().map(tool => tool.schema));
    if (signature === this._webmcpToolsSignature)
      return;
    this._webmcpToolsSignature = signature;
    this.options.onWebMCPToolsChanged?.();
  }

  private _setCurrentTab(tab: Tab | undefined) {
    if (this._currentTab === tab)
      return;
    this._currentTab = tab;
    this.maybeNotifyWebMCPToolsChanged();
  }

  routes(): RouteEntry[] {
    return this._routes;
  }

  async addRoute(entry: RouteEntry): Promise<void> {
    for (const browserContext of await this._allBrowserContexts())
      await browserContext.route(entry.pattern, entry.handler);
    this._routes.push(entry);
  }

  async removeRoute(pattern?: string): Promise<number> {
    const toRemove = pattern ? this._routes.filter(r => r.pattern === pattern) : this._routes;
    for (const browserContext of await this._allBrowserContexts()) {
      for (const route of toRemove)
        await browserContext.unroute(route.pattern, route.handler);
    }
    this._routes = this._routes.filter(r => !toRemove.includes(r));
    return toRemove.length;
  }

  isRunningTool() {
    return this._runningToolName !== undefined;
  }

  setRunningTool(name: string | undefined) {
    this._runningToolName = name;
  }

  private async _setupRequestInterception(context: playwrightTypes.BrowserContext, disposables: Disposable[]) {
    if (this.config.network?.allowedOrigins?.length) {
      disposables.push(await context.route('**', route => route.abort('blockedbyclient')));

      for (const origin of this.config.network.allowedOrigins) {
        const glob = originOrHostGlob(origin);
        disposables.push(await context.route(glob, route => route.continue()));
      }
    }

    if (this.config.network?.blockedOrigins?.length) {
      for (const origin of this.config.network.blockedOrigins)
        disposables.push(await context.route(originOrHostGlob(origin), route => route.abort('blockedbyclient')));
    }
  }

  async ensureBrowserContext(isolatedContext?: string): Promise<playwrightTypes.BrowserContext> {
    if (!isolatedContext || isolatedContext === 'default')
      isolatedContext = undefined;
    let browserContext = this._browserContexts.get(isolatedContext);
    if (!browserContext) {
      browserContext = this._initializeBrowserContext(isolatedContext);
      this._browserContexts.set(isolatedContext, browserContext);
      browserContext.catch(() => this._browserContexts.delete(isolatedContext));
    }
    return await browserContext;
  }

  async currentBrowserContext(): Promise<playwrightTypes.BrowserContext> {
    return this._currentTab?.page.context() ?? await this.ensureBrowserContext();
  }

  private async _allBrowserContexts(): Promise<playwrightTypes.BrowserContext[]> {
    await this.ensureBrowserContext();
    return await Promise.all(this._browserContexts.values());
  }

  private async _initializeBrowserContext(isolatedContext: string | undefined): Promise<playwrightTypes.BrowserContext> {
    const browserContext = isolatedContext ? await this._createIsolatedContext(isolatedContext) : this._defaultBrowserContext;
    // Isolated contexts are closed in dispose(), which tears down their routes, scripts and listeners.
    const disposables = isolatedContext ? [] : this._disposables;
    await this._setupRequestInterception(browserContext, disposables);

    for (const initScript of this.config.browser?.initScript || [])
      disposables.push(await browserContext.addInitScript({ path: path.resolve(this.options.cwd, initScript) }));

    for (const route of this._routes)
      await browserContext.route(route.pattern, route.handler);

    for (const page of browserContext.pages())
      this._onPageCreated(page, isolatedContext);
    disposables.push(eventsHelper.addEventListener(browserContext, 'page', page => this._onPageCreated(page, isolatedContext)));
    await this._startContextTracing(isolatedContext, browserContext);
    return browserContext;
  }

  private async _createIsolatedContext(name: string): Promise<playwrightTypes.BrowserContext> {
    await this.ensureBrowserContext();
    const browser = this._defaultBrowserContext.browser();
    if (!browser)
      throw new Error('Isolated contexts are not supported for this browser.');
    const browserContext = await browser.newContext(this.config.browser?.contextOptions);
    browserContext.once('close', () => this._browserContexts.delete(name));
    return browserContext;
  }

  checkUrlAllowed(url: string) {
    if (this.config.allowUnrestrictedFileAccess)
      return;
    if (!URL.canParse(url))
      return;
    if (new URL(url).protocol === 'file:')
      throw new Error(`Access to "file:" protocol is blocked. Attempted URL: "${url}"`);
  }

  lookupSecret(secretName: string): { value: string, code: string, isSecret: boolean } {
    if (!this.config.secrets?.[secretName])
      return { value: secretName, code: escapeWithQuotes(secretName, '\''), isSecret: false };
    return {
      value: this.config.secrets[secretName]!,
      code: secretCode(this.codegenLanguage(), secretName),
      isSecret: true,
    };
  }

  redactSecrets(text: string): string {
    for (const [secretName, secretValue] of Object.entries(this.config.secrets ?? {})) {
      if (!secretValue)
        continue;
      text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
    }
    return text;
  }
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

export async function workspaceFile(options: ContextOptions, fileName: string, perCallWorkspaceDir?: string): Promise<string> {
  const workspace = perCallWorkspaceDir ?? options.cwd;
  const resolvedName = path.resolve(workspace, fileName);
  await checkFile(options, resolvedName, { origin: 'llm' });
  return resolvedName;
}

export function outputDir(options: ContextOptions): string {
  if (options.config.outputDir)
    return path.resolve(options.config.outputDir);
  const baseName = options.config.skillMode ? '.playwright-cli' : '.playwright-mcp';
  if (isSystemDirectory(options.cwd) || !isWritable(options.cwd))
    return path.join(os.tmpdir(), baseName);
  return path.join(options.cwd, baseName);
}

export async function outputFile(options: ContextOptions, fileName: string, flags: { origin: 'code' | 'llm' }): Promise<string> {
  const resolvedFile = path.resolve(outputDir(options), fileName);
  await checkFile(options, resolvedFile, flags);
  await fs.promises.mkdir(path.dirname(resolvedFile), { recursive: true });
  debug('pw:mcp:file')(resolvedFile);
  return resolvedFile;
}

async function checkFile(options: ContextOptions, resolvedFilename: string, flags: { origin: 'code' | 'llm' }) {
  // Trust code and unrestricted file access.
  if (flags.origin === 'code' || options.config.allowUnrestrictedFileAccess || options.config.skillMode)
    return;

  // Trust llm to use valid characters in file names.
  const output = outputDir(options);
  const workspace = options.cwd;
  // Follow symlinks, an unresolvable root cannot be traversed anyway.
  const [realOutput, realWorkspace, realFilename] = await Promise.all([
    resolveSymlinks(output).catch(() => output),
    resolveSymlinks(workspace).catch(() => workspace),
    resolveSymlinks(resolvedFilename),
  ]);
  if (!isPathInside(realOutput, realFilename) && !isPathInside(realWorkspace, realFilename))
    throw new Error(`File access denied: ${resolvedFilename} is outside allowed roots. Allowed roots: ${output}, ${workspace}`);
}
