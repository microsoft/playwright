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
import { BrowserFetcher, BrowserFetcherOptions, OnProgressCallback, BrowserFetcherRevisionInfo } from '../server/browserFetcher';
import { DeviceDescriptors } from '../deviceDescriptors';
import * as Errors from '../errors';
import * as types from '../types';
import { WKLauncher, LauncherLaunchOptions, createBrowserFetcher } from './wkLauncher';
import { WKBrowser } from './wkBrowser';

export class WKPlaywright {
  private _projectRoot: string;
  private _launcher: WKLauncher;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._launcher = new WKLauncher(projectRoot, preferredRevision);
    this._revision = preferredRevision;
  }

  async downloadBrowser(options?: BrowserFetcherOptions & { onProgress?: OnProgressCallback }): Promise<BrowserFetcherRevisionInfo> {
    const fetcher = this.createBrowserFetcher(options);
    const revisionInfo = fetcher.revisionInfo(this._revision);
    await fetcher.download(this._revision, options ? options.onProgress : undefined);
    return revisionInfo;
  }

  async launch(options: (LauncherLaunchOptions) | undefined): Promise<WKBrowser> {
    const server = await this._launcher.launch(options);
    return server.connect();
  }

  async launchServer(options: (LauncherLaunchOptions) | undefined): Promise<browsers.BrowserServer<WKBrowser>> {
    return this._launcher.launch(options);
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
    return createBrowserFetcher(this._projectRoot, options);
  }
}
