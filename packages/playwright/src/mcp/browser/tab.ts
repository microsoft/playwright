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
import { EventEmitter } from 'events';
import * as playwright from 'playwright-core';
import { asLocator, ManualPromise } from 'playwright-core/lib/utils';

import { callOnPageNoTrace, waitForCompletion, eventWaiter, dateAsFileName } from './tools/utils';
import { logUnhandledError } from '../log';
import { ModalState } from './tools/tool';
import { handleDialog } from './tools/dialogs';
import { uploadFile } from './tools/files';
import { requireOrImport } from '../../transform/transform';

import type { Context } from './context';
import type { Page } from '../../../../playwright-core/src/client/page';
import type { Locator } from '../../../../playwright-core/src/client/locator';
import type { FullConfig } from './config';

export const TabEvents = {
  modalState: 'modalState'
};

export type TabEventsInterface = {
  [TabEvents.modalState]: [modalState: ModalState];
};

type Download = {
  download: playwright.Download;
  finished: boolean;
  outputFile: string;
};

type ConsoleLogEntry = {
  type: 'console';
  wallTime: number;
  message: ConsoleMessage;
};

type DownloadStartLogEntry = {
  type: 'download-start';
  wallTime: number;
  download: Download;
};

type DownloadFinishLogEntry = {
  type: 'download-finish';
  wallTime: number;
  download: Download;
};

type RequestLogEntry = {
  type: 'request';
  wallTime: number;
  request: playwright.Request;
};

type EventEntry = ConsoleLogEntry | DownloadStartLogEntry | DownloadFinishLogEntry | RequestLogEntry;


export type TabHeader = {
  title: string;
  url: string;
  current: boolean;
};

export type LogChunk = {
  file: string;
  fromLine: number;
  toLine: number;
  entryCount: number;
};

export type TabSnapshot = {
  ariaSnapshot: string;
  ariaSnapshotDiff?: string;
  modalStates: ModalState[];
  events: EventEntry[];
  logChunk?: LogChunk;
};

class LogFile {
  private _startTime: number = Date.now();
  private _context: Context;
  private _filePrefix: string;
  private _title: string;

  private _file: string | undefined;
  private _stopped: boolean = false;

  private _line: number = 0;
  private _entries: number = 0;
  private _lastLine: number = 0;
  private _lastEntries: number = 0;

  private _writeChain: Promise<void> = Promise.resolve();

  constructor(context: Context, filePrefix: string, title: string) {
    this._context = context;
    this._filePrefix = filePrefix;
    this._title = title;
  }

  appendLine(wallTime: number, text: string) {
    this._writeChain = this._writeChain.then(() => this._write(wallTime, text)).catch(logUnhandledError);
  }

  stop() {
    this._stopped = true;
  }

  async take(): Promise<LogChunk | undefined> {
    await this._writeChain;
    if (!this._file || this._entries === this._lastEntries)
      return undefined;
    const chunk: LogChunk = {
      file: this._file,
      fromLine: this._lastLine + 1,
      toLine: this._line,
      entryCount: this._entries - this._lastEntries,
    };
    this._lastLine = this._line;
    this._lastEntries = this._entries;
    return chunk;
  }

  private async _write(wallTime: number, text: string) {
    if (this._stopped)
      return;
    this._file ??= await this._context.outputFile(dateAsFileName(this._filePrefix, 'log', new Date(this._startTime)), { origin: 'code', title: this._title });
    const relativeTime = wallTime - this._startTime;

    const logLine = `[${String(relativeTime).padStart(8, ' ')}ms] ${text}\n`;
    await fs.promises.appendFile(this._file, logLine);

    const lineCount = logLine.split('\n').length - 1;
    this._line += lineCount;
    this._entries++;
  }
}

export class Tab extends EventEmitter<TabEventsInterface> {
  readonly context: Context;
  readonly page: Page;
  private _lastHeader: TabHeader = { title: 'about:blank', url: 'about:blank', current: false };
  private _consoleMessages: ConsoleMessage[] = [];
  private _downloads: Download[] = [];
  private _requests: Set<playwright.Request> = new Set();
  private _onPageClose: (tab: Tab) => void;
  private _modalStates: ModalState[] = [];
  private _initializedPromise: Promise<void>;
  private _needsFullSnapshot = false;
  private _recentEventEntries: EventEntry[] = [];
  private _consoleLog: LogFile | undefined;

  constructor(context: Context, page: playwright.Page, onPageClose: (tab: Tab) => void) {
    super();
    this.context = context;
    this.page = page as Page;
    this._onPageClose = onPageClose;
    page.on('console', event => this._handleConsoleMessage(messageToConsoleMessage(event)));
    page.on('pageerror', error => this._handleConsoleMessage(pageErrorToConsoleMessage(error)));
    page.on('request', request => this._handleRequest(request));
    page.on('close', () => this._onClose());
    page.on('filechooser', chooser => {
      this.setModalState({
        type: 'fileChooser',
        description: 'File chooser',
        fileChooser: chooser,
        clearedBy: { tool: uploadFile.schema.name, skill: 'upload' }
      });
    });
    page.on('dialog', dialog => this._dialogShown(dialog));
    page.on('download', download => {
      void this._downloadStarted(download);
    });
    page.setDefaultNavigationTimeout(this.context.config.timeouts.navigation);
    page.setDefaultTimeout(this.context.config.timeouts.action);
    (page as any)[tabSymbol] = this;
    this._resetConsoleLogFile();
    this._initializedPromise = this._initialize();
  }

  static forPage(page: playwright.Page): Tab | undefined {
    return (page as any)[tabSymbol];
  }

  static async collectConsoleMessages(page: playwright.Page): Promise<ConsoleMessage[]> {
    const result: ConsoleMessage[] = [];
    const messages = await page.consoleMessages().catch(() => []);
    for (const message of messages)
      result.push(messageToConsoleMessage(message));
    const errors = await page.pageErrors().catch(() => []);
    for (const error of errors)
      result.push(pageErrorToConsoleMessage(error));
    return result;
  }

  private async _initialize() {
    for (const message of await Tab.collectConsoleMessages(this.page))
      this._handleConsoleMessage(message);
    const requests = await this.page.requests().catch(() => []);
    for (const request of requests)
      this._requests.add(request);
    for (const initPage of this.context.config.browser.initPage || []) {
      try {
        const { default: func } = await requireOrImport(initPage);
        await func({ page: this.page });
      } catch (e) {
        logUnhandledError(e);
      }
    }
  }

  modalStates(): ModalState[] {
    return this._modalStates;
  }

  setModalState(modalState: ModalState) {
    this._modalStates.push(modalState);
    this.emit(TabEvents.modalState, modalState);
  }

  clearModalState(modalState: ModalState) {
    this._modalStates = this._modalStates.filter(state => state !== modalState);
  }

  private _dialogShown(dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
      clearedBy: { tool: handleDialog.schema.name, skill: 'dialog-accept or dialog-dismiss' }
    });
  }

  private async _downloadStarted(download: playwright.Download) {
    const entry = {
      download,
      finished: false,
      outputFile: await this.context.outputFile(download.suggestedFilename(), { origin: 'web', title: 'Saving download' })
    };
    this._downloads.push(entry);
    this._addLogEntry({ type: 'download-start', wallTime: Date.now(), download: entry });
    await download.saveAs(entry.outputFile);
    entry.finished = true;
    this._addLogEntry({ type: 'download-finish', wallTime: Date.now(), download: entry });
  }

  private _clearCollectedArtifacts() {
    this._consoleMessages.length = 0;
    this._downloads.length = 0;
    this._requests.clear();
    this._recentEventEntries.length = 0;
    this._resetConsoleLogFile();
  }

  private _resetConsoleLogFile() {
    if (this.context.config.outputMode !== 'file')
      return;
    this._consoleLog?.stop();
    this._consoleLog = new LogFile(this.context, 'console', 'Console');
  }

  private _handleRequest(request: playwright.Request) {
    this._requests.add(request);
    this._addLogEntry({ type: 'request', wallTime: Date.now(), request });
  }

  private _handleConsoleMessage(message: ConsoleMessage) {
    this._consoleMessages.push(message);
    const wallTime = Date.now();
    this._addLogEntry({ type: 'console', wallTime, message });
    this._consoleLog?.appendLine(wallTime, message.toString());
  }

  private _addLogEntry(entry: EventEntry) {
    this._recentEventEntries.push(entry);
  }

  private _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }

  async headerSnapshot(): Promise<TabHeader & { changed: boolean }> {
    let title: string | undefined;
    await this._raceAgainstModalStates(async () => {
      title = await callOnPageNoTrace(this.page, page => page.title());
    });
    if (this._lastHeader.title !== title || this._lastHeader.url !== this.page.url() || this._lastHeader.current !== this.isCurrentTab()) {
      this._lastHeader = { title: title ?? '', url: this.page.url(), current: this.isCurrentTab() };
      return { ...this._lastHeader, changed: true };
    }
    return { ...this._lastHeader, changed: false };
  }


  isCurrentTab(): boolean {
    return this === this.context.currentTab();
  }

  async waitForLoadState(state: 'load', options?: { timeout?: number }): Promise<void> {
    await this._initializedPromise;
    await callOnPageNoTrace(this.page, page => page.waitForLoadState(state, options).catch(logUnhandledError));
  }

  async navigate(url: string) {
    await this._initializedPromise;
    this._clearCollectedArtifacts();

    const { promise: downloadEvent, abort: abortDownloadEvent } = eventWaiter<playwright.Download>(this.page, 'download', 3000);
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      abortDownloadEvent();
    } catch (_e: unknown) {
      const e = _e as Error;
      const mightBeDownload =
        e.message.includes('net::ERR_ABORTED') // chromium
        || e.message.includes('Download is starting'); // firefox + webkit
      if (!mightBeDownload)
        throw e;
      // on chromium, the download event is fired *after* page.goto rejects, so we wait a lil bit
      const download = await downloadEvent;
      if (!download)
        throw e;
      // Make sure other "download" listeners are notified first.
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }

    // Cap load event to 5 seconds, the page is operational at this point.
    await this.waitForLoadState('load', { timeout: 5000 });
  }

  async consoleMessages(level: ConsoleMessageLevel): Promise<ConsoleMessage[]> {
    await this._initializedPromise;
    return this._consoleMessages.filter(message => shouldIncludeMessage(level, message.type));
  }

  async clearConsoleMessages() {
    await this._initializedPromise;
    this._consoleMessages.length = 0;
  }

  async requests(): Promise<Set<playwright.Request>> {
    await this._initializedPromise;
    return this._requests;
  }

  async clearRequests() {
    await this._initializedPromise;
    this._requests.clear();
  }

  async captureSnapshot(): Promise<TabSnapshot> {
    await this._initializedPromise;
    let tabSnapshot: TabSnapshot | undefined;
    const modalStates = await this._raceAgainstModalStates(async () => {
      const snapshot = await this.page._snapshotForAI({ track: 'response' });
      tabSnapshot = {
        ariaSnapshot: snapshot.full,
        ariaSnapshotDiff: this._needsFullSnapshot ? undefined : snapshot.incremental,
        modalStates: [],
        events: []
      };
    });
    if (tabSnapshot) {
      tabSnapshot.logChunk = await this._consoleLog?.take();
      tabSnapshot.events = this._recentEventEntries;
      this._recentEventEntries = [];
    }

    // If we failed to capture a snapshot this time, make sure we do a full one next time,
    // to avoid reporting deltas against un-reported snapshot.
    this._needsFullSnapshot = !tabSnapshot;
    return tabSnapshot ?? {
      ariaSnapshot: '',
      ariaSnapshotDiff: '',
      modalStates,
      events: [],
    };
  }

  private _javaScriptBlocked(): boolean {
    return this._modalStates.some(state => state.type === 'dialog');
  }

  private async _raceAgainstModalStates(action: () => Promise<void>): Promise<ModalState[]> {
    if (this.modalStates().length)
      return this.modalStates();

    const promise = new ManualPromise<ModalState[]>();
    const listener = (modalState: ModalState) => promise.resolve([modalState]);
    this.once(TabEvents.modalState, listener);

    return await Promise.race([
      action().then(() => {
        this.off(TabEvents.modalState, listener);
        return [];
      }),
      promise,
    ]);
  }

  async waitForCompletion(callback: () => Promise<void>) {
    await this._initializedPromise;
    await this._raceAgainstModalStates(() => waitForCompletion(this, callback));
  }

  async refLocator(params: { element?: string, ref: string }): Promise<{ locator: Locator, resolved: string }> {
    await this._initializedPromise;
    return (await this.refLocators([params]))[0];
  }

  async refLocators(params: { element?: string, ref: string }[]): Promise<{ locator: Locator, resolved: string }[]> {
    await this._initializedPromise;
    return Promise.all(params.map(async param => {
      try {
        let locator = this.page.locator(`aria-ref=${param.ref}`);
        if (param.element)
          locator = locator.describe(param.element);
        const { resolvedSelector } = await locator._resolveSelector();
        return { locator, resolved: asLocator('javascript', resolvedSelector) };
      } catch (e) {
        throw new Error(`Ref ${param.ref} not found in the current page snapshot. Try capturing new snapshot.`);
      }
    }));
  }

  async waitForTimeout(time: number) {
    if (this._javaScriptBlocked()) {
      await new Promise(f => setTimeout(f, time));
      return;
    }

    await callOnPageNoTrace(this.page, page => {
      return page.evaluate(() => new Promise(f => setTimeout(f, 1000))).catch(() => {});
    });
  }
}

export type ConsoleMessage = {
  type: ReturnType<playwright.ConsoleMessage['type']>;
  text: string;
  toString(): string;
};

function messageToConsoleMessage(message: playwright.ConsoleMessage): ConsoleMessage {
  return {
    type: message.type(),
    text: message.text(),
    toString: () => `[${message.type().toUpperCase()}] ${message.text()} @ ${message.location().url}:${message.location().lineNumber}`,
  };
}

function pageErrorToConsoleMessage(errorOrValue: Error | any): ConsoleMessage {
  if (errorOrValue instanceof Error) {
    return {
      type: 'error',
      text: errorOrValue.message,
      toString: () => errorOrValue.stack || errorOrValue.message,
    };
  }
  return {
    type: 'error',
    text: String(errorOrValue),
    toString: () => String(errorOrValue),
  };
}

export function renderModalStates(config: FullConfig, modalStates: ModalState[]): string[] {
  const result: string[] = [];
  if (modalStates.length === 0)
    result.push('- There is no modal state present');
  for (const state of modalStates)
    result.push(`- [${state.description}]: can be handled by ${config.skillMode ? state.clearedBy.skill : state.clearedBy.tool}`);
  return result;
}

type ConsoleMessageType = ReturnType<playwright.ConsoleMessage['type']>;
type ConsoleMessageLevel = 'error' | 'warning' | 'info' | 'debug';
const consoleMessageLevels: ConsoleMessageLevel[] = ['error', 'warning', 'info', 'debug'];

export function shouldIncludeMessage(thresholdLevel: ConsoleMessageLevel, type: ConsoleMessageType): boolean {
  const messageLevel = consoleLevelForMessageType(type);
  return consoleMessageLevels.indexOf(messageLevel) <= consoleMessageLevels.indexOf(thresholdLevel);
}

function consoleLevelForMessageType(type: ConsoleMessageType): ConsoleMessageLevel {
  switch (type) {
    case 'assert':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'count':
    case 'dir':
    case 'dirxml':
    case 'info':
    case 'log':
    case 'table':
    case 'time':
    case 'timeEnd':
      return 'info';
    case 'clear':
    case 'debug':
    case 'endGroup':
    case 'profile':
    case 'profileEnd':
    case 'startGroup':
    case 'startGroupCollapsed':
    case 'trace':
      return 'debug';
    default:
      return 'info';
  }
}

const tabSymbol = Symbol('tabSymbol');
