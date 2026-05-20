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
import { isPathInside, isSystemDirectory, isWritable } from '@utils/fileUtils';
import { playwright } from '../../inprocess';

import { PageRecorder } from './pageRecorder';
import { Tab } from './tab';

import type * as playwrightTypes from '../../..';
import type { SessionLog } from './sessionLog';
import type { Disposable } from '@isomorphic/disposable';
import type { ToolCapability } from './tool';

const testDebug = debug('pw:mcp:test');

export type ContextConfig = {
  allowUnrestrictedFileAccess?: boolean;
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
  recordVideo?: {
    size?: { width: number; height: number };
    dir?: string;
  };
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
  private _pageRecorders = new Map<playwrightTypes.Page, PageRecorder>();
  private _disposables: Disposable[] = [];

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
    await this.ensureBrowserContext();
    const crashed = this._currentTab?.crashed;
    if (crashed) {
      await this._currentTab!.page.close().catch(() => {});
      this._currentTab = undefined;
    }
    if (!this._currentTab)
      await this.newTab();
    if (crashed)
      this._currentTab!.logErrorMessage('Page crashed and was reset to about:blank.');
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
      await this._stopPageVideo(page);
    this._video = undefined;
    return [...video.fileNames];
  }

  private _nextVideoFileName(): string {
    if (!this._video)
      throw new Error('No active video session');
    const suffix = this._video.fileNames.length ? `-${this._video.fileNames.length}` : '';
    let fileName = this._video.fileName;
    if (suffix) {
      const ext = path.extname(fileName);
      fileName = path.basename(fileName, ext) + suffix + ext;
    }
    this._video.fileNames.push(fileName);
    return fileName;
  }

  private async _startPageVideo(page: playwrightTypes.Page) {
    if (!this._video)
      return;
    const fileName = this._nextVideoFileName();
    const recorder = this._pageRecorders.get(page);
    if (recorder) {
      await page.screencast.stop();
      await page.screencast.start({ onFrame: frame => recorder.writeFrame(frame.data, Date.now()), path: fileName, ...this._video.params });
    } else {
      await page.screencast.start({ path: fileName, ...this._video.params });
    }
  }

  private async _stopPageVideo(page: playwrightTypes.Page) {
    const recorder = this._pageRecorders.get(page);
    await page.screencast.stop();
    if (recorder)
      await page.screencast.start({ onFrame: frame => recorder.writeFrame(frame.data, Date.now()) });
  }

  private _onPageCreated(page: playwrightTypes.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
    if (this.config.recordVideo?.dir)
      void this._startPageRecorder(page);
    else if (this._video)
      this._startPageVideo(page).catch(() => {});
  }

  private _onPageClosed(tab: Tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);

    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];

    const recorder = this._pageRecorders.get(tab.page);
    if (recorder) {
      this._pageRecorders.delete(tab.page);
      recorder.stop().catch(e => testDebug(`PageRecorder stop failed: ${(e as Error).message}`));
    }
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

    if (this.config.recordVideo?.dir)
      this._setupRecording();

    for (const page of browserContext.pages())
      this._onPageCreated(page);
    this._disposables.push(eventsHelper.addEventListener(browserContext, 'page', page => this._onPageCreated(page)));

    return browserContext;
  }

  private _setupRecording() {
    const dir = this.config.recordVideo!.dir!;
    fs.mkdirSync(dir, { recursive: true });
    this._rawBrowserContext.once('close', () => {
      for (const recorder of this._pageRecorders.values())
        recorder.stop().catch(() => {});
      this._pageRecorders.clear();
      fs.rmSync(dir, { recursive: true, force: true });
    });
  }

  // TODO: review this
  private async _startPageRecorder(page: playwrightTypes.Page) {
    const dir = this.config.recordVideo!.dir!;
    // Default size when not provided: fall back to a reasonable 1280x720
    // (matches Playwright's screencast default). We need a concrete size
    // up-front because ffmpeg's filter chain is fixed at launch.
    const recordSize = this.config.recordVideo!.size ?? { width: 1280, height: 720 };
    // eslint-disable-next-line no-restricted-syntax -- _guid is conservative.
    const guid = (page as any)._guid as string;
    try {
      const recorder = await PageRecorder.create({ recordingDir: dir, pageId: guid, size: recordSize });
      this._pageRecorders.set(page, recorder);
      const videoPath = this._video ? this._nextVideoFileName() : undefined;
      await page.screencast.start({ onFrame: frame => recorder.writeFrame(frame.data, Date.now()), size: recordSize, path: videoPath, ...(this._video?.params ?? {}) });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Failed to start video recording for page ${guid}:`, (e as Error).message);
    }
  }

  checkUrlAllowed(url: string) {
    if (this.config.allowUnrestrictedFileAccess)
      return;
    if (!URL.canParse(url))
      return;
    if (new URL(url).protocol === 'file:')
      throw new Error(`Access to "file:" protocol is blocked. Attempted URL: "${url}"`);
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
  if (!isPathInside(output, resolvedFilename) && !isPathInside(workspace, resolvedFilename))
    throw new Error(`File access denied: ${resolvedFilename} is outside allowed roots. Allowed roots: ${output}, ${workspace}`);
}
