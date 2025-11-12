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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { chromiumSwitches } from './chromiumSwitches';
import { CRBrowser } from './crBrowser';
import { kBrowserCloseMessageId } from './crConnection';
import { debugMode, headersArrayToObject } from '../../utils';
import { wrapInASCIIBox } from '../utils/ascii';
import { RecentLogsCollector } from '../utils/debugLogger';
import { ManualPromise } from '../../utils/isomorphic/manualPromise';
import { fetchData } from '../utils/network';
import { getUserAgent } from '../utils/userAgent';
import { validateBrowserContextOptions } from '../browserContext';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import { helper } from '../helper';
import { registry } from '../registry';
import { WebSocketTransport } from '../transport';
import { CRDevTools } from './crDevTools';
import { Browser } from '../browser';
import { removeFolders } from '../utils/fileUtils';

import type { BrowserOptions, BrowserProcess } from '../browser';
import type { SdkObject } from '../instrumentation';
import type { Progress } from '../progress';
import type { ProtocolError } from '../protocolError';
import type { ConnectionTransport, ProtocolRequest } from '../transport';
import type { BrowserContext } from '../browserContext';
import type * as types from '../types';
import type * as channels from '@protocol/channels';

const ARTIFACTS_FOLDER = path.join(os.tmpdir(), 'playwright-artifacts-');

export class Chromium extends BrowserType {
  private _devtools: CRDevTools | undefined;
  private _bidiChromium: BrowserType;

  constructor(parent: SdkObject, bidiChromium: BrowserType) {
    super(parent, 'chromium');
    this._bidiChromium = bidiChromium;

    if (debugMode() === 'inspector')
      this._devtools = this._createDevTools();
  }

  override launch(progress: Progress, options: types.LaunchOptions, protocolLogger?: types.ProtocolLogger): Promise<Browser> {
    if (options.channel?.startsWith('bidi-'))
      return this._bidiChromium.launch(progress, options, protocolLogger);
    return super.launch(progress, options, protocolLogger);
  }

  override async launchPersistentContext(progress: Progress, userDataDir: string, options: channels.BrowserTypeLaunchPersistentContextOptions & { cdpPort?: number, internalIgnoreHTTPSErrors?: boolean, socksProxyPort?: number }): Promise<BrowserContext> {
    if (options.channel?.startsWith('bidi-'))
      return this._bidiChromium.launchPersistentContext(progress, userDataDir, options);
    return super.launchPersistentContext(progress, userDataDir, options);
  }

  override async connectOverCDP(progress: Progress, endpointURL: string, options: { slowMo?: number, headers?: types.HeadersArray }) {
    let headersMap: { [key: string]: string; } | undefined;
    if (options.headers)
      headersMap = headersArrayToObject(options.headers, false);

    if (!headersMap)
      headersMap = { 'User-Agent': getUserAgent() };
    else if (headersMap && !Object.keys(headersMap).some(key => key.toLowerCase() === 'user-agent'))
      headersMap['User-Agent'] = getUserAgent();

    const artifactsDir = await progress.race(fs.promises.mkdtemp(ARTIFACTS_FOLDER));
    const doCleanup = async () => {
      await removeFolders([artifactsDir]);
    };

    let chromeTransport: WebSocketTransport | undefined;
    const doClose = async () => {
      await chromeTransport?.closeAndWait();
      await doCleanup();
    };

    try {
      const wsEndpoint = await urlToWSEndpoint(progress, endpointURL, headersMap);
      chromeTransport = await WebSocketTransport.connect(progress, wsEndpoint, { headers: headersMap });

      const browserProcess: BrowserProcess = { close: doClose, kill: doClose };
      const persistent: types.BrowserContextOptions = { noDefaultViewport: true };
      const browserOptions: BrowserOptions = {
        slowMo: options.slowMo,
        name: 'chromium',
        isChromium: true,
        persistent,
        browserProcess,
        protocolLogger: helper.debugProtocolLogger(),
        browserLogsCollector: new RecentLogsCollector(),
        artifactsDir,
        downloadsPath: artifactsDir,
        tracesDir: artifactsDir,
        originalLaunchOptions: {},
      };
      validateBrowserContextOptions(persistent, browserOptions);
      const browser = await progress.race(CRBrowser.connect(this.attribution.playwright, chromeTransport, browserOptions));
      browser._isCollocatedWithServer = false;
      browser.on(Browser.Events.Disconnected, doCleanup);
      return browser;
    } catch (error) {
      await doClose().catch(() => {});
      throw error;
    }
  }

  private _createDevTools() {
    // TODO: this is totally wrong when using channels.
    const directory = registry.findExecutable('chromium').directory;
    return directory ? new CRDevTools(path.join(directory, 'devtools-preferences.json')) : undefined;
  }

  override async connectToTransport(transport: ConnectionTransport, options: BrowserOptions, browserLogsCollector: RecentLogsCollector): Promise<CRBrowser> {
    let devtools = this._devtools;
    if ((options as any).__testHookForDevTools) {
      devtools = this._createDevTools();
      await (options as any).__testHookForDevTools(devtools);
    }
    try {
      return await CRBrowser.connect(this.attribution.playwright, transport, options, devtools);
    } catch (e) {
      if (browserLogsCollector.recentLogs().some(log => log.includes('Failed to create a ProcessSingleton for your profile directory.'))) {
        throw new Error(
            'Failed to create a ProcessSingleton for your profile directory. ' +
            'This usually means that the profile is already in use by another instance of Chromium.'
        );
      }
      throw e;
    }
  }

  override doRewriteStartupLog(error: ProtocolError): ProtocolError {
    if (!error.logs)
      return error;
    if (error.logs.includes('Missing X server'))
      error.logs = '\n' + wrapInASCIIBox(kNoXServerRunningError, 1);
    // These error messages are taken from Chromium source code as of July, 2020:
    // https://github.com/chromium/chromium/blob/70565f67e79f79e17663ad1337dc6e63ee207ce9/content/browser/zygote_host/zygote_host_impl_linux.cc
    if (!error.logs.includes('crbug.com/357670') && !error.logs.includes('No usable sandbox!') && !error.logs.includes('crbug.com/638180'))
      return error;
    error.logs = [
      `Chromium sandboxing failed!`,
      `================================`,
      `To avoid the sandboxing issue, do either of the following:`,
      `  - (preferred): Configure your environment to support sandboxing`,
      `  - (alternative): Launch Chromium without sandbox using 'chromiumSandbox: false' option`,
      `================================`,
      ``,
    ].join('\n');
    return error;
  }

  override amendEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return env;
  }

  override attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    // Note that it's fine to reuse the transport, since our connection ignores kBrowserCloseMessageId.
    const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
    transport.send(message);
  }

  override async defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string) {
    const chromeArguments = this._innerDefaultArgs(options);
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    if (options.cdpPort !== undefined)
      chromeArguments.push(`--remote-debugging-port=${options.cdpPort}`);
    else
      chromeArguments.push('--remote-debugging-pipe');
    if (isPersistent)
      chromeArguments.push('about:blank');
    else
      chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }

  private _innerDefaultArgs(options: types.LaunchOptions): string[] {
    const { args = [] } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw this._createUserDataDirArgMisuseError('--user-data-dir');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...chromiumSwitches(options.assistantMode, options.channel)];

    if (os.platform() === 'darwin') {
      // See https://issues.chromium.org/issues/40277080
      chromeArguments.push('--enable-unsafe-swiftshader');
    }

    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      chromeArguments.push('--headless');

      chromeArguments.push(
          '--hide-scrollbars',
          '--mute-audio',
          '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
      );
    }
    if (options.chromiumSandbox !== true)
      chromeArguments.push('--no-sandbox');
    const proxy = options.proxyOverride || options.proxy;
    if (proxy) {
      const proxyURL = new URL(proxy.server);
      const isSocks = proxyURL.protocol === 'socks5:';
      // https://www.chromium.org/developers/design-documents/network-settings
      if (isSocks && !options.socksProxyPort) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
      if (options.socksProxyPort)
        proxyBypassRules.push('<-loopback>');
      if (proxy.bypass)
        proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
      if (!process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK && !proxyBypassRules.includes('<-loopback>'))
        proxyBypassRules.push('<-loopback>');
      if (proxyBypassRules.length > 0)
        chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
    }
    chromeArguments.push(...args);
    return chromeArguments;
  }

  override async waitForReadyState(options: types.LaunchOptions, browserLogsCollector: RecentLogsCollector): Promise<{ wsEndpoint?: string }> {
    return waitForReadyState(options, browserLogsCollector);
  }

  override getExecutableName(options: types.LaunchOptions): string {
    if (options.channel)
      return options.channel;
    return options.headless ? 'chromium-headless-shell' : 'chromium';
  }
}

export async function waitForReadyState(options: types.LaunchOptions, browserLogsCollector: RecentLogsCollector): Promise<{ wsEndpoint?: string }> {
  if (options.cdpPort === undefined && !options.args?.some(a => a.startsWith('--remote-debugging-port')))
    return {};

  const result = new ManualPromise<{ wsEndpoint?: string }>();
  browserLogsCollector.onMessage(message => {
    if (message.includes('Failed to create a ProcessSingleton for your profile directory.')) {
      result.reject(new Error('Failed to create a ProcessSingleton for your profile directory. ' +
        'This usually means that the profile is already in use by another instance of Chromium.'));
    }
    const match = message.match(/DevTools listening on (.*)/);
    if (match)
      result.resolve({ wsEndpoint: match[1] });
  });
  return result;
}

async function urlToWSEndpoint(progress: Progress, endpointURL: string, headers: { [key: string]: string; }) {
  if (endpointURL.startsWith('ws'))
    return endpointURL;
  progress.log(`<ws preparing> retrieving websocket url from ${endpointURL}`);
  const url = new URL(endpointURL);
  if (!url.pathname.endsWith('/'))
    url.pathname += '/';
  url.pathname += 'json/version/';
  const httpURL = url.toString();

  const json = await fetchData(progress, {
    url: httpURL,
    headers,
  }, async (_, resp) => new Error(`Unexpected status ${resp.statusCode} when connecting to ${httpURL}.\n` +
    `This does not look like a DevTools server, try connecting via ws://.`)
  );
  return JSON.parse(json).webSocketDebuggerUrl;
}
