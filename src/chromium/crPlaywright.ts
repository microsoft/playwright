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

import * as http from 'http';
import * as https from 'https';
import * as URL from 'url';
import * as browsers from '../browser';
import { BrowserFetcher, BrowserFetcherOptions, BrowserFetcherRevisionInfo, OnProgressCallback } from '../browserFetcher';
import { DeviceDescriptor, DeviceDescriptors } from '../deviceDescriptors';
import * as Errors from '../errors';
import { assert } from '../helper';
import { ConnectionTransport, WebSocketTransport, SlowMoTransport } from '../transport';
import { ConnectionOptions, createBrowserFetcher, CRLauncher, LauncherChromeArgOptions, LauncherLaunchOptions } from './crLauncher';
import { CRBrowser } from './crBrowser';

type Devices = { [name: string]: DeviceDescriptor } & DeviceDescriptor[];

export class CRPlaywright {
  private _projectRoot: string;
  private _launcher: CRLauncher;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._launcher = new CRLauncher(projectRoot, preferredRevision);
    this._revision = preferredRevision;
  }

  async downloadBrowser(options?: BrowserFetcherOptions & { onProgress?: OnProgressCallback }): Promise<BrowserFetcherRevisionInfo> {
    const fetcher = this.createBrowserFetcher(options);
    const revisionInfo = fetcher.revisionInfo(this._revision);
    await fetcher.download(this._revision, options ? options.onProgress : undefined);
    return revisionInfo;
  }

  async launch(options?: (LauncherLaunchOptions & LauncherChromeArgOptions & ConnectionOptions) | undefined): Promise<CRBrowser> {
    const server = await this._launcher.launch(options);
    return server.connect();
  }

  async launchServer(options: (LauncherLaunchOptions & LauncherChromeArgOptions & ConnectionOptions) = {}): Promise<browsers.BrowserServer<CRBrowser>> {
    return this._launcher.launch(options);
  }

  async connect(options: (ConnectionOptions & {
      browserWSEndpoint?: string;
      browserURL?: string;
      transport?: ConnectionTransport; })): Promise<CRBrowser> {
    assert(Number(!!options.browserWSEndpoint) + Number(!!options.browserURL) + Number(!!options.transport) === 1, 'Exactly one of browserWSEndpoint, browserURL or transport must be passed to playwright.connect');

    let transport: ConnectionTransport | undefined;
    let connectionURL: string = '';
    if (options.transport) {
      transport = options.transport;
    } else if (options.browserWSEndpoint) {
      connectionURL = options.browserWSEndpoint;
      transport = await WebSocketTransport.create(options.browserWSEndpoint);
    } else if (options.browserURL) {
      connectionURL = await getWSEndpoint(options.browserURL);
      transport = await WebSocketTransport.create(connectionURL);
    }
    return CRBrowser.create(SlowMoTransport.wrap(transport, options.slowMo));
  }

  executablePath(): string {
    return this._launcher.executablePath();
  }

  get devices(): Devices {
    const result = DeviceDescriptors.slice() as Devices;
    for (const device of DeviceDescriptors)
      result[device.name] = device;
    return result;
  }

  get errors(): any {
    return Errors;
  }

  defaultArgs(options: LauncherChromeArgOptions | undefined): string[] {
    return this._launcher.defaultArgs(options);
  }

  createBrowserFetcher(options?: BrowserFetcherOptions): BrowserFetcher {
    return createBrowserFetcher(this._projectRoot, options);
  }
}

function getWSEndpoint(browserURL: string): Promise<string> {
  let resolve: (url: string) => void;
  let reject: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });

  const endpointURL = URL.resolve(browserURL, '/json/version');
  const protocol = endpointURL.startsWith('https') ? https : http;
  const requestOptions = Object.assign(URL.parse(endpointURL), { method: 'GET' });
  const request = protocol.request(requestOptions, res => {
    let data = '';
    if (res.statusCode !== 200) {
      // Consume response data to free up memory.
      res.resume();
      reject(new Error('HTTP ' + res.statusCode));
      return;
    }
    res.setEncoding('utf8');
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(JSON.parse(data).webSocketDebuggerUrl));
  });

  request.on('error', reject);
  request.end();

  return promise.catch(e => {
    e.message = `Failed to fetch browser webSocket url from ${endpointURL}: ` + e.message;
    throw e;
  });
}