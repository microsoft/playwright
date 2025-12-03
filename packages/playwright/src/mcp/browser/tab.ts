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

import { EventEmitter } from 'events';
import * as playwright from 'playwright-core';
import { asLocator, ManualPromise } from 'playwright-core/lib/utils';

import { callOnPageNoTrace, waitForCompletion } from './tools/utils';
import { logUnhandledError } from '../log';
import { ModalState } from './tools/tool';
import { handleDialog } from './tools/dialogs';
import { uploadFile } from './tools/files';
import { requireOrImport } from '../../transform/transform';

import type { Context } from './context';
import type { Page } from '../../../../playwright-core/src/client/page';
import type { Locator } from '../../../../playwright-core/src/client/locator';

export const TabEvents = {
  modalState: 'modalState'
};

export type TabEventsInterface = {
  [TabEvents.modalState]: [modalState: ModalState];
};

export type TabSnapshot = {
  url: string;
  title: string;
  ariaSnapshot: string;
  ariaSnapshotDiff?: string;
  modalStates: ModalState[];
  consoleMessages: ConsoleMessage[];
  downloads: { download: playwright.Download, finished: boolean, outputFile: string }[];
};

export class Tab extends EventEmitter<TabEventsInterface> {
  readonly context: Context;
  readonly page: Page;
  private _lastTitle = 'about:blank';
  private _consoleMessages: ConsoleMessage[] = [];
  private _recentConsoleMessages: ConsoleMessage[] = [];
  private _requests: Set<playwright.Request> = new Set();
  private _onPageClose: (tab: Tab) => void;
  private _modalStates: ModalState[] = [];
  private _downloads: { download: playwright.Download, finished: boolean, outputFile: string }[] = [];
  // TODO: split into Tab and TabHeader
  private _initializedPromise: Promise<void>;
  private _needsFullSnapshot = false;

  constructor(context: Context, page: playwright.Page, onPageClose: (tab: Tab) => void) {
    super();
    this.context = context;
    this.page = page as Page;
    this._onPageClose = onPageClose;
    page.on('console', event => this._handleConsoleMessage(messageToConsoleMessage(event)));
    page.on('pageerror', error => this._handleConsoleMessage(pageErrorToConsoleMessage(error)));
    page.on('request', request => this._requests.add(request));
    page.on('close', () => this._onClose());
    page.on('filechooser', chooser => {
      this.setModalState({
        type: 'fileChooser',
        description: 'File chooser',
        fileChooser: chooser,
        clearedBy: uploadFile.schema.name,
      });
    });
    page.on('dialog', dialog => this._dialogShown(dialog));
    page.on('download', download => {
      void this._downloadStarted(download);
    });
    page.setDefaultNavigationTimeout(this.context.config.timeouts.navigation);
    page.setDefaultTimeout(this.context.config.timeouts.action);
    (page as any)[tabSymbol] = this;
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

  modalStatesMarkdown(): string[] {
    return renderModalStates(this.context, this.modalStates());
  }

  private _dialogShown(dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
      clearedBy: handleDialog.schema.name
    });
  }

  private async _downloadStarted(download: playwright.Download) {
    const entry = {
      download,
      finished: false,
      outputFile: await this.context.outputFile(download.suggestedFilename(), { origin: 'web', reason: 'Saving download' })
    };
    this._downloads.push(entry);
    await download.saveAs(entry.outputFile);
    entry.finished = true;
  }

  private _clearCollectedArtifacts() {
    this._consoleMessages.length = 0;
    this._recentConsoleMessages.length = 0;
    this._requests.clear();
  }

  private _handleConsoleMessage(message: ConsoleMessage) {
    this._consoleMessages.push(message);
    this._recentConsoleMessages.push(message);
  }

  private _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }

  async updateTitle() {
    await this._raceAgainstModalStates(async () => {
      this._lastTitle = await callOnPageNoTrace(this.page, page => page.title());
    });
  }

  lastTitle(): string {
    return this._lastTitle;
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

    const downloadEvent = callOnPageNoTrace(this.page, page => page.waitForEvent('download').catch(logUnhandledError));
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (_e: unknown) {
      const e = _e as Error;
      const mightBeDownload =
        e.message.includes('net::ERR_ABORTED') // chromium
        || e.message.includes('Download is starting'); // firefox + webkit
      if (!mightBeDownload)
        throw e;
      // on chromium, the download event is fired *after* page.goto rejects, so we wait a lil bit
      const download = await Promise.race([
        downloadEvent,
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
      if (!download)
        throw e;
      // Make sure other "download" listeners are notified first.
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }

    // Cap load event to 5 seconds, the page is operational at this point.
    await this.waitForLoadState('load', { timeout: 5000 });
  }

  async consoleMessages(type?: 'error'): Promise<ConsoleMessage[]> {
    await this._initializedPromise;
    return this._consoleMessages.filter(message => type ? message.type === type : true);
  }

  async requests(): Promise<Set<playwright.Request>> {
    await this._initializedPromise;
    return this._requests;
  }

  async captureSnapshot(): Promise<TabSnapshot> {
    await this._initializedPromise;
    let tabSnapshot: TabSnapshot | undefined;
    const modalStates = await this._raceAgainstModalStates(async () => {
      const snapshot = await this.page._snapshotForAI({ track: 'response' });
      tabSnapshot = {
        url: this.page.url(),
        title: await this.page.title(),
        ariaSnapshot: snapshot.full,
        ariaSnapshotDiff: this._needsFullSnapshot ? undefined : snapshot.incremental,
        modalStates: [],
        consoleMessages: [],
        downloads: this._downloads,
      };
    });
    if (tabSnapshot) {
      // Assign console message late so that we did not lose any to modal state.
      tabSnapshot.consoleMessages = this._recentConsoleMessages;
      this._recentConsoleMessages = [];
    }
    // If we failed to capture a snapshot this time, make sure we do a full one next time,
    // to avoid reporting deltas against un-reported snapshot.
    this._needsFullSnapshot = !tabSnapshot;
    return tabSnapshot ?? {
      url: this.page.url(),
      title: '',
      ariaSnapshot: '',
      modalStates,
      consoleMessages: [],
      downloads: [],
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

  async refLocator(params: { element: string, ref: string }): Promise<{ locator: Locator, resolved: string }> {
    await this._initializedPromise;
    return (await this.refLocators([params]))[0];
  }

  async refLocators(params: { element: string, ref: string }[]): Promise<{ locator: Locator, resolved: string }[]> {
    await this._initializedPromise;
    return Promise.all(params.map(async param => {
      try {
        const locator = this.page.locator(`aria-ref=${param.ref}`).describe(param.element) as Locator;
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
  type: ReturnType<playwright.ConsoleMessage['type']> | undefined;
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

export function renderModalStates(context: Context, modalStates: ModalState[]): string[] {
  const result: string[] = ['### Modal state'];
  if (modalStates.length === 0)
    result.push('- There is no modal state present');
  for (const state of modalStates)
    result.push(`- [${state.description}]: can be handled by the "${state.clearedBy}" tool`);
  return result;
}

const tabSymbol = Symbol('tabSymbol');
