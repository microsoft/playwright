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
import { BrowserContext, Video } from './browserContext';
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
  readonly _idToVideo = new Map<string, Video>();

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

  _videoStarted(context: BrowserContext, videoId: string, path: string, pageOrError: Promise<Page | Error>) {
    const video = new Video(context, videoId, path);
    this._idToVideo.set(videoId, video);
    context.emit(BrowserContext.Events.VideoStarted, video);
    pageOrError.then(pageOrError => {
      if (pageOrError instanceof Page)
        pageOrError.emit(Page.Events.VideoStarted, video);
    });
  }

  _videoFinished(videoId: string) {
    const video = this._idToVideo.get(videoId)!;
    this._idToVideo.delete(videoId);
    video._finish();
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

