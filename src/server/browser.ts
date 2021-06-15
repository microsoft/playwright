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
import { BrowserContext } from './browserContext';
import { Page } from './page';
import { Download } from './download';
import { ProxySettings } from './types';
import { ChildProcess } from 'child_process';
import { RecentLogsCollector } from '../utils/debugLogger';
import * as registry from '../utils/registry';
import { SdkObject } from './instrumentation';
import { Artifact } from './artifact';
import { Selectors } from './selectors';

export interface BrowserProcess {
  onclose?: ((exitCode: number | null, signal: string | null) => void);
  process?: ChildProcess;
  kill(): Promise<void>;
  close(): Promise<void>;
}

export type PlaywrightOptions = {
  registry: registry.Registry,
  rootSdkObject: SdkObject,
  selectors: Selectors,
  loopbackProxyOverride?: () => string,
};

export type BrowserOptions = PlaywrightOptions & {
  name: string,
  isChromium: boolean,
  channel?: string,
  artifactsDir: string;
  downloadsPath: string,
  tracesDir: string,
  headful?: boolean,
  persistent?: types.BrowserContextOptions,  // Undefined means no persistent context.
  browserProcess: BrowserProcess,
  customExecutablePath?: string;
  proxy?: ProxySettings,
  protocolLogger: types.ProtocolLogger,
  browserLogsCollector: RecentLogsCollector,
  slowMo?: number;
  wsEndpoint?: string;  // Only there when connected over web socket.
};

export abstract class Browser extends SdkObject {
  static Events = {
    Disconnected: 'disconnected',
  };

  readonly options: BrowserOptions;
  private _downloads = new Map<string, Download>();
  _defaultContext: BrowserContext | null = null;
  private _startedClosing = false;
  readonly _idToVideo = new Map<string, { context: BrowserContext, artifact: Artifact }>();

  constructor(options: BrowserOptions) {
    super(options.rootSdkObject, 'browser');
    this.attribution.browser = this;
    this.options = options;
  }

  abstract newContext(options: types.BrowserContextOptions): Promise<BrowserContext>;
  abstract contexts(): BrowserContext[];
  abstract isConnected(): boolean;
  abstract version(): string;

  _downloadCreated(page: Page, uuid: string, url: string, suggestedFilename?: string) {
    const download = new Download(page, this.options.downloadsPath || '', uuid, url, suggestedFilename);
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
    download.artifact.reportFinished(error);
    this._downloads.delete(uuid);
  }

  _videoStarted(context: BrowserContext, videoId: string, path: string, pageOrError: Promise<Page | Error>) {
    const artifact = new Artifact(context, path);
    this._idToVideo.set(videoId, { context, artifact });
    context.emit(BrowserContext.Events.VideoStarted, artifact);
    pageOrError.then(page => {
      if (page instanceof Page) {
        page._video = artifact;
        page.emit(Page.Events.Video, artifact);
      }
    });
  }

  _takeVideo(videoId: string): Artifact | undefined {
    const video = this._idToVideo.get(videoId);
    this._idToVideo.delete(videoId);
    return video?.artifact;
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
      await this.options.browserProcess.close();
    }
    if (this.isConnected())
      await new Promise(x => this.once(Browser.Events.Disconnected, x));
  }

  async killForTests() {
    await this.options.browserProcess.kill();
  }
}
