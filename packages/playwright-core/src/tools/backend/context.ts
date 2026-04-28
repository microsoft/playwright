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
import path from 'path';

import debug from 'debug';
import { escapeWithQuotes } from '@isomorphic/stringUtils';
import { disposeAll } from '@isomorphic/disposable';
import { eventsHelper } from '@utils/eventsHelper';
import { playwright } from '../../inprocess';

import { Tab } from './tab';

import type * as playwrightTypes from '../../..';
import type { SessionLog } from './sessionLog';
import type { Disposable } from '@isomorphic/disposable';
import type { ToolCapability } from './tool';

const testDebug = debug('pw:mcp:test');

export type ContextConfig = {
  allowUnrestrictedFileAccess?: boolean;
  autoRecord?: boolean;
  capabilities?: ToolCapability[];
  codegen?: 'typescript' | 'none';
  console?: { level?: 'error' | 'warning' | 'info' | 'debug' };
  imageResponses?: 'allow' | 'omit';
  network?: {
    allowedOrigins?: string[];
    blockedOrigins?: string[];
  };
  outputDir?: string;
  outputMode?: 'file' | 'stdout';
  saveSession?: boolean;
  saveTrace?: boolean;
  secrets?: Record<string, string>;
  snapshot?: {
    mode?: 'full' | 'none';
  };
  testIdAttribute?: string;
  timeouts?: {
    action?: number;
    navigation?: number;
    expect?: number;
  };
  browser?: {
    initScript?: string[];
    initPage?: string[];
  };
  skillMode?: boolean;
};

type ContextOptions = {
  config: ContextConfig;
  sessionLog?: SessionLog;
  cwd: string;
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

type VideoParams = { size?: { width: number; height: number } };

export type RecordedEvent =
  | { type: 'navigate'; url: string }
  | { type: 'click'; selector: string }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'selectOption'; selector: string; value: string }
  | { type: 'check'; selector: string }
  | { type: 'uncheck'; selector: string };

type RecordingState = {
  events: RecordedEvent[];
  disposables: Disposable[];
};

// Injected into every page to bridge user interactions to Node via exposeFunction.
const CAPTURE_SCRIPT = `(function() {
  if (window.__pw_capture_installed) return;
  window.__pw_capture_installed = true;
  function _sel(el) {
    if (!el || el === document.body) return null;
    var v;
    v = el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-pw'));
    if (v) return '[data-testid=' + JSON.stringify(v) + ']';
    v = el.getAttribute && el.getAttribute('aria-label');
    if (v) return '[aria-label=' + JSON.stringify(v) + ']';
    v = el.getAttribute && el.getAttribute('placeholder');
    if (v) return '[placeholder=' + JSON.stringify(v) + ']';
    v = el.getAttribute && el.getAttribute('name');
    if (v) return '[name=' + JSON.stringify(v) + ']';
    if (el.id) return '#' + el.id;
    var tag = (el.tagName || '').toLowerCase();
    var txt = (el.textContent || '').trim().slice(0, 50);
    if (txt && (tag === 'button' || tag === 'a'))
      return tag + ':has-text(' + JSON.stringify(txt) + ')';
    return tag || null;
  }
  document.addEventListener('click', function(e) {
    if (typeof window.__pw_record !== 'function') return;
    var s = _sel(e.target);
    if (s) window.__pw_record({ type: 'click', selector: s });
  }, true);
  document.addEventListener('change', function(e) {
    if (typeof window.__pw_record !== 'function') return;
    var el = e.target;
    if (!el) return;
    var s = _sel(el);
    if (!s) return;
    var tag = (el.tagName || '').toLowerCase();
    var tp = (el.type || '').toLowerCase();
    if (tag === 'select') {
      window.__pw_record({ type: 'selectOption', selector: s, value: el.value });
    } else if (tp === 'checkbox') {
      window.__pw_record({ type: el.checked ? 'check' : 'uncheck', selector: s });
    } else if (tp === 'radio') {
      if (el.checked) window.__pw_record({ type: 'check', selector: s });
    } else {
      window.__pw_record({ type: 'fill', selector: s, value: el.value });
    }
  }, true);
})()`;

export class Context {
  readonly config: ContextConfig;
  readonly sessionLog: SessionLog | undefined;
  readonly options: ContextOptions;
  private _rawBrowserContext: playwrightTypes.BrowserContext;
  private _browserContextPromise: Promise<playwrightTypes.BrowserContext> | undefined;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _routes: RouteEntry[] = [];
  private _video: {
    params: VideoParams;
    fileNames: string[];
    fileName: string;
  } | undefined;
  private _disposables: Disposable[] = [];

  private _runningToolName: string | undefined;
  private _pendingUnhandledRejections: unknown[] = [];
  private _unhandledRejectionListeners = new Set<(reason: unknown) => void>();
  private _onUnhandledRejection = (reason: unknown) => {
    this._pendingUnhandledRejections.push(reason);
    for (const listener of this._unhandledRejectionListeners)
      listener(reason);
  };
  private _recordingState: RecordingState | undefined;
  private _stoppedEvents: RecordedEvent[] = [];
  private _recordingSetUp = false;

  constructor(browserContext: playwrightTypes.BrowserContext, options: ContextOptions) {
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this.options = options;
    this._rawBrowserContext = browserContext;
    testDebug('create context');
    process.on('unhandledRejection', this._onUnhandledRejection);
  }

  async dispose() {
    process.off('unhandledRejection', this._onUnhandledRejection);
    await disposeAll(this._disposables);
    for (const tab of this._tabs)
      await tab.dispose();
    this._tabs.length = 0;
    this._currentTab = undefined;
    await this.stopVideoRecording();
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
    return this._rawBrowserContext.debugger;
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
    return await workspaceFile(this.options, fileName, perCallWorkspaceDir);
  }

  async outputFile(template: FilenameTemplate, options: { origin: 'code' | 'llm' }): Promise<string> {
    const baseName = template.suggestedFilename || `${template.prefix}-${(template.date ?? new Date()).toISOString().replace(/[:.]/g, '-')}${template.ext ? '.' + template.ext : ''}`;
    return await outputFile(this.options, baseName, options);
  }

  async startVideoRecording(fileName: string, params: VideoParams) {
    if (this._video)
      throw new Error('Video recording has already been started.');
    this._video = { params, fileName, fileNames: [] };
    const browserContext = await this.ensureBrowserContext();
    for (const page of browserContext.pages())
      await this._startPageVideo(page);
  }

  async stopVideoRecording(): Promise<string[]> {
    if (!this._video)
      return [];
    const video = this._video;
    for (const page of this._rawBrowserContext.pages())
      await page.screencast.stop();
    this._video = undefined;
    return [...video.fileNames];
  }

  private async _startPageVideo(page: playwrightTypes.Page) {
    if (!this._video)
      return;
    const suffix = this._video.fileNames.length ? `-${this._video.fileNames.length}` : '';
    let fileName = this._video.fileName;
    if (fileName && suffix) {
      const ext = path.extname(fileName);
      fileName = path.basename(fileName, ext) + suffix + ext;
    }
    this._video.fileNames.push(fileName);
    await page.screencast.start({ path: fileName, ...this._video.params });
  }

  private _onPageCreated(page: playwrightTypes.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
    this._startPageVideo(page).catch(() => { });
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
    const browserContext = await this.ensureBrowserContext();
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

  private async _setupRequestInterception(context: playwrightTypes.BrowserContext) {
    if (this.config.network?.allowedOrigins?.length) {
      this._disposables.push(await context.route('**', route => route.abort('blockedbyclient')));

      for (const origin of this.config.network.allowedOrigins) {
        const glob = originOrHostGlob(origin);
        this._disposables.push(await context.route(glob, route => route.continue()));
      }
    }

    if (this.config.network?.blockedOrigins?.length) {
      for (const origin of this.config.network.blockedOrigins)
        this._disposables.push(await context.route(originOrHostGlob(origin), route => route.abort('blockedbyclient')));
    }
  }

  async ensureBrowserContext(): Promise<playwrightTypes.BrowserContext> {
    if (this._browserContextPromise)
      return this._browserContextPromise;
    this._browserContextPromise = this._initializeBrowserContext();
    return this._browserContextPromise;
  }

  private async _initializeBrowserContext() {
    if (this.config.testIdAttribute)
      playwright.selectors.setTestIdAttribute(this.config.testIdAttribute);
    const browserContext = this._rawBrowserContext;
    await this._setupRequestInterception(browserContext);

    if (this.config.saveTrace) {
      await browserContext.tracing.start({
        name: 'trace-' + Date.now(),
        screenshots: true,
        snapshots: true,
        live: true,
      });
      this._disposables.push({
        dispose: async () => {
          await browserContext.tracing.stop();
        },
      });
    }
    for (const initScript of this.config.browser?.initScript || [])
      this._disposables.push(await browserContext.addInitScript({ path: path.resolve(this.options.cwd, initScript) }));

    for (const page of browserContext.pages())
      this._onPageCreated(page);
    this._disposables.push(eventsHelper.addEventListener(browserContext, 'page', page => this._onPageCreated(page)));

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

  async startRecording(): Promise<void> {
    if (this._recordingState)
      throw new Error('A recording session is already in progress. Call `browser_recording_stop` first.');
    this._stoppedEvents = [];
    const state: RecordingState = { events: [], disposables: [] };
    this._recordingState = state;
    const browserContext = await this.ensureBrowserContext();
    if (!this._recordingSetUp) {
      this._recordingSetUp = true;
      // exposeFunction and addInitScript persist for the lifetime of the context.
      await browserContext.exposeFunction('__pw_record', (event: unknown) => {
        if (this._recordingState)
          this._recordingState.events.push(event as RecordedEvent);
      });
      this._disposables.push(await browserContext.addInitScript(CAPTURE_SCRIPT));
    }
    const attachToPage = (page: playwrightTypes.Page) => {
      const navHandler = (frame: playwrightTypes.Frame) => {
        if (frame === page.mainFrame() && this._recordingState) {
          const url = frame.url();
          if (url && url !== 'about:blank')
            this._recordingState.events.push({ type: 'navigate', url });
        }
      };
      page.on('framenavigated', navHandler);
      state.disposables.push({ dispose: () => page.off('framenavigated', navHandler) });
      page.evaluate(CAPTURE_SCRIPT).catch(() => { });
    };
    for (const page of browserContext.pages())
      attachToPage(page);
    state.disposables.push(eventsHelper.addEventListener(browserContext, 'page', attachToPage));
  }

  stopRecording(): number {
    const state = this._recordingState;
    if (!state)
      return 0;
    disposeAll(state.disposables).catch(() => { });
    this._stoppedEvents = state.events;
    this._recordingState = undefined;
    return state.events.length;
  }

  async resetRecording(): Promise<void> {
    // Stop the active session if one is running.
    if (this._recordingState) {
      disposeAll(this._recordingState.disposables).catch(() => { });
      this._recordingState = undefined;
    }
    // Clear the stopped-event buffer so the next recording starts clean.
    this._stoppedEvents = [];
    // Start a fresh session immediately.
    await this.startRecording();
  }

  getRecordedCode(): string[] {
    const events = this._recordingState?.events ?? this._stoppedEvents;
    return events.map(event => {
      switch (event.type) {
        case 'navigate':
          return `await page.goto(${escapeWithQuotes(event.url, "'")});`;
        case 'click':
          return `await page.locator(${escapeWithQuotes(event.selector, "'")}).click();`;
        case 'fill':
          return `await page.locator(${escapeWithQuotes(event.selector, "'")}).fill(${escapeWithQuotes(event.value, "'")});`;
        case 'selectOption':
          return `await page.locator(${escapeWithQuotes(event.selector, "'")}).selectOption(${escapeWithQuotes(event.value, "'")});`;
        case 'check':
          return `await page.locator(${escapeWithQuotes(event.selector, "'")}).check();`;
        case 'uncheck':
          return `await page.locator(${escapeWithQuotes(event.selector, "'")}).uncheck();`;
      }
    });
  }

  saveRecordingAsTest(testName: string, outputPath: string): string {
    const lines = this.getRecordedCode();
    const body = lines.map(l => `  ${l}`).join('\n');
    const content = [
      `import { test, expect } from '@playwright/test';`,
      ``,
      `test(${escapeWithQuotes(testName, "'")}, async ({ page }) => {`,
      body,
      `});`,
      ``,
    ].join('\n');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');
    return content;
  }

  lookupSecret(secretName: string): { value: string, code: string } {
    if (!this.config.secrets?.[secretName])
      return { value: secretName, code: escapeWithQuotes(secretName, '\'') };
    return {
      value: this.config.secrets[secretName]!,
      code: `process.env['${secretName}']`,
    };
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
  return path.resolve(options.cwd, options.config.skillMode ? '.playwright-cli' : '.playwright-mcp');
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
  const withinDir = (root: string) => resolvedFilename === root || resolvedFilename.startsWith(root + path.sep);
  if (!withinDir(output) && !withinDir(workspace))
    throw new Error(`File access denied: ${resolvedFilename} is outside allowed roots. Allowed roots: ${output}, ${workspace}`);
}
