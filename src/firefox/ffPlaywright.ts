/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as browsers from '../browser';
import { FFBrowser } from './ffBrowser';
import { BrowserFetcher, BrowserFetcherOptions, OnProgressCallback, BrowserFetcherRevisionInfo } from '../server/browserFetcher';
import { SlowMoTransport } from '../transport';
import { DeviceDescriptors } from '../deviceDescriptors';
import * as Errors from '../errors';
import * as types from '../types';
import { FFLauncher, createBrowserFetcher } from './ffLauncher';
import * as platform from '../platform';

export class FFPlaywright {
  private _projectRoot: string;
  private _launcher: FFLauncher;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._launcher = new FFLauncher(projectRoot, preferredRevision);
    this._revision = preferredRevision;
  }

  async downloadBrowser(options?: BrowserFetcherOptions & { onProgress?: OnProgressCallback }): Promise<BrowserFetcherRevisionInfo> {
    const fetcher = this.createBrowserFetcher(options);
    const revisionInfo = fetcher.revisionInfo(this._revision);
    await fetcher.download(this._revision, options ? options.onProgress : undefined);
    return revisionInfo;
  }

  async launch(options: any): Promise<FFBrowser> {
    const server = await this._launcher.launch(options);
    return server.connect();
  }

  async launchServer(options: any): Promise<browsers.BrowserServer<FFBrowser>> {
    return this._launcher.launch(options);
  }

  async connect(options: { slowMo?: number, browserWSEndpoint: string }): Promise<FFBrowser> {
    const transport = await platform.createWebSocketTransport(options.browserWSEndpoint);
    return FFBrowser.create(SlowMoTransport.wrap(transport, options.slowMo || 0));
  }

  executablePath(): string {
    return this._launcher.executablePath();
  }

  get devices(): types.Devices {
    return DeviceDescriptors;
  }

  get errors(): any {
    return Errors;
  }

  defaultArgs(options: any | undefined): string[] {
    return this._launcher.defaultArgs(options);
  }

  createBrowserFetcher(options?: BrowserFetcherOptions): BrowserFetcher {
    return  createBrowserFetcher(this._projectRoot, options);
  }
}
