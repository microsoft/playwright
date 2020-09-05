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

import * as types from './types';
import { BrowserContext, Screencast } from './browserContext';
import { Page } from './page';
import { EventEmitter } from 'events';
import { Download } from './download';
import { ProxySettings } from './types';
import { ChildProcess } from 'child_process';

export interface BrowserProcess {
  onclose: ((exitCode: number | null, signal: string | null) => void) | undefined;
  process: ChildProcess;
  kill(): Promise<void>;
  close(): Promise<void>;
}

export type BrowserOptions = types.UIOptions & {
  name: string,
  downloadsPath?: string,
  _videosPath?: string,
  headful?: boolean,
  persistent?: types.BrowserContextOptions,  // Undefined means no persistent context.
  browserProcess: BrowserProcess,
  proxy?: ProxySettings,
};

export abstract class Browser extends EventEmitter {
  static Events = {
    Disconnected: 'disconnected',
  };

  readonly _options: BrowserOptions;
  private _downloads = new Map<string, Download>();
  _defaultContext: BrowserContext | null = null;
  private _startedClosing = false;
  private readonly _idToScreencast = new Map<string, Screencast>();

  constructor(options: BrowserOptions) {
    super();
    this._options = options;
  }

  abstract newContext(options?: types.BrowserContextOptions): Promise<BrowserContext>;
  abstract contexts(): BrowserContext[];
  abstract isConnected(): boolean;
  abstract version(): string;

  async newPage(options?: types.BrowserContextOptions): Promise<Page> {
    const context = await this.newContext(options);
    const page = await context.newPage();
    page._ownedContext = context;
    return page;
  }

  _downloadCreated(page: Page, uuid: string, url: string, suggestedFilename?: string) {
    const download = new Download(page, this._options.downloadsPath || '', uuid, url, suggestedFilename);
    this._downloads.set(uuid, download);
  }

  _downloadFilenameSuggested(uuid: string, suggestedFilename: string) {
    const download = this._downloads.get(uuid);
    if (!download)
      return;
    download._filenameSuggested(suggestedFilename);
  }

  _downloadFinished(uuid: string, error?: string) {
    const download = this._downloads.get(uuid);
    if (!download)
      return;
    download._reportFinished(error);
    this._downloads.delete(uuid);
  }

  _screencastStarted(screencastId: string, file: string): Screencast {
    const screencast = new Screencast(screencastId, file);
    this._idToScreencast.set(screencastId, screencast);
    return screencast;
  }

  _screencastFinished(screencastId: string) {
    const screencast = this._idToScreencast.get(screencastId);
    this._idToScreencast.delete(screencastId);
    screencast!._finishCallback();
  }

  _didClose() {
    for (const context of this.contexts())
      context._browserClosed();
    if (this._defaultContext)
      this._defaultContext._browserClosed();
    this.emit(Browser.Events.Disconnected);
  }

  async close() {
    if (!this._startedClosing) {
      this._startedClosing = true;
      await this._options.browserProcess.close();
    }
    if (this.isConnected())
      await new Promise(x => this.once(Browser.Events.Disconnected, x));
  }
}

