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
import type stream from 'stream';
import { CRBrowser } from './crBrowser';
import type { Env } from '../../utils/processLauncher';
import { gracefullyCloseSet } from '../../utils/processLauncher';
import { kBrowserCloseMessageId } from './crConnection';
import { BrowserType, kNoXServerRunningError } from '../browserType';
import type { ConnectionTransport, ProtocolRequest } from '../transport';
import { WebSocketTransport } from '../transport';
import { CRDevTools } from './crDevTools';
import type { BrowserOptions, BrowserProcess } from '../browser';
import { Browser } from '../browser';
import type * as types from '../types';
import type * as channels from '@protocol/channels';
import type { HTTPRequestParams } from '../../utils/network';
import { fetchData } from '../../utils/network';
import { getUserAgent } from '../../utils/userAgent';
import { wrapInASCIIBox } from '../../utils/ascii';
import { debugMode, headersArrayToObject, headersObjectToArray, } from '../../utils';
import { removeFolders } from '../../utils/fileUtils';
import { RecentLogsCollector } from '../../utils/debugLogger';
import type { Progress } from '../progress';
import { ProgressController } from '../progress';
import { TimeoutSettings } from '../../common/timeoutSettings';
import { helper } from '../helper';
import type { CallMetadata, SdkObject } from '../instrumentation';
import type http from 'http';
import { registry } from '../registry';
import { ManualPromise } from '../../utils/manualPromise';
import { validateBrowserContextOptions } from '../browserContext';
import { chromiumSwitches } from './chromiumSwitches';
import type { ProtocolError } from '../protocolError';

const ARTIFACTS_FOLDER = path.join(os.tmpdir(), 'playwright-artifacts-');

export class Chromium extends BrowserType {
  private _devtools: CRDevTools | undefined;

  constructor(parent: SdkObject) {
    super(parent, 'chromium');

    if (debugMode())
      this._devtools = this._createDevTools();
  }

  override async connectOverCDP(metadata: CallMetadata, endpointURL: string, options: { slowMo?: number, headers?: types.HeadersArray }, timeout?: number) {
    const controller = new ProgressController(metadata, this);
    controller.setLogName('browser');
    return controller.run(async progress => {
      return await this._connectOverCDPInternal(progress, endpointURL, options);
    }, TimeoutSettings.timeout({ timeout }));
  }

  async _connectOverCDPInternal(progress: Progress, endpointURL: string, options: types.LaunchOptions & { headers?: types.HeadersArray }, onClose?: () => Promise<void>) {
    let headersMap: { [key: string]: string; } | undefined;
    if (options.headers)
      headersMap = headersArrayToObject(options.headers, false);

    if (!headersMap)
      headersMap = { 'User-Agent': getUserAgent() };
    else if (headersMap && !Object.keys(headersMap).some(key => key.toLowerCase() === 'user-agent'))
      headersMap['User-Agent'] = getUserAgent();

    const artifactsDir = await fs.promises.mkdtemp(ARTIFACTS_FOLDER);

    const wsEndpoint = await urlToWSEndpoint(progress, endpointURL, headersMap);
    progress.throwIfAborted();

    const chromeTransport = await WebSocketTransport.connect(progress, wsEndpoint, headersMap);
    const cleanedUp = new ManualPromise<void>();
    const doCleanup = async () => {
      await removeFolders([artifactsDir]);
      await onClose?.();
      cleanedUp.resolve();
    };
    const doClose = async () => {
      await chromeTransport.closeAndWait();
      await cleanedUp;
    };
    const browserProcess: BrowserProcess = { close: doClose, kill: doClose };
    const persistent: channels.BrowserNewContextParams = { noDefaultViewport: true };
    const browserOptions: BrowserOptions = {
      slowMo: options.slowMo,
      name: 'chromium',
      isChromium: true,
      persistent,
      browserProcess,
      protocolLogger: helper.debugProtocolLogger(),
      browserLogsCollector: new RecentLogsCollector(),
      artifactsDir,
      downloadsPath: options.downloadsPath || artifactsDir,
      tracesDir: options.tracesDir || artifactsDir,
      // On Windows context level proxies only work, if there isn't a global proxy
      // set. This is currently a bug in the CR/Windows networking stack. By
      // passing an arbitrary value we disable the check in PW land which warns
      // users in normal (launch/launchServer) mode since otherwise connectOverCDP
      // does not work at all with proxies on Windows.
      proxy: { server: 'per-context' },
      originalLaunchOptions: {},
    };
    validateBrowserContextOptions(persistent, browserOptions);
    progress.throwIfAborted();
    const browser = await CRBrowser.connect(this.attribution.playwright, chromeTransport, browserOptions);
    browser._isCollocatedWithServer = false;
    browser.on(Browser.Events.Disconnected, doCleanup);
    return browser;
  }

  private _createDevTools() {
    // TODO: this is totally wrong when using channels.
    const directory = registry.findExecutable('chromium').directory;
    return directory ? new CRDevTools(path.join(directory, 'devtools-preferences.json')) : undefined;
  }

  async _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<CRBrowser> {
    let devtools = this._devtools;
    if ((options as any).__testHookForDevTools) {
      devtools = this._createDevTools();
      await (options as any).__testHookForDevTools(devtools);
    }
    return CRBrowser.connect(this.attribution.playwright, transport, options, devtools);
  }

  _doRewriteStartupLog(error: ProtocolError): ProtocolError {
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

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return env;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
    transport.send(message);
  }

  override async _launchWithSeleniumHub(progress: Progress, hubUrl: string, options: types.LaunchOptions): Promise<CRBrowser> {
    await this._createArtifactDirs(options);

    if (!hubUrl.endsWith('/'))
      hubUrl = hubUrl + '/';

    const args = this._innerDefaultArgs(options);
    args.push('--remote-debugging-port=0');
    const isEdge = options.channel && options.channel.startsWith('msedge');
    let desiredCapabilities = {
      'browserName': isEdge ? 'MicrosoftEdge' : 'chrome',
      [isEdge ? 'ms:edgeOptions' : 'goog:chromeOptions']: { args }
    };

    if (process.env.SELENIUM_REMOTE_CAPABILITIES) {
      const remoteCapabilities = parseSeleniumRemoteParams({ name: 'capabilities', value: process.env.SELENIUM_REMOTE_CAPABILITIES }, progress);
      if (remoteCapabilities)
        desiredCapabilities = { ...desiredCapabilities, ...remoteCapabilities };
    }

    let headers: { [key: string]: string } = {};
    if (process.env.SELENIUM_REMOTE_HEADERS) {
      const remoteHeaders = parseSeleniumRemoteParams({ name: 'headers', value: process.env.SELENIUM_REMOTE_HEADERS }, progress);
      if (remoteHeaders)
        headers = remoteHeaders;
    }

    progress.log(`<selenium> connecting to ${hubUrl}`);
    const response = await fetchData({
      url: hubUrl + 'session',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers,
      },
      data: JSON.stringify({
        capabilities: { alwaysMatch: desiredCapabilities }
      }),
      timeout: progress.timeUntilDeadline(),
    }, seleniumErrorHandler);
    const value = JSON.parse(response).value;
    const sessionId = value.sessionId;
    progress.log(`<selenium> connected to sessionId=${sessionId}`);

    const disconnectFromSelenium = async () => {
      progress.log(`<selenium> disconnecting from sessionId=${sessionId}`);
      await fetchData({
        url: hubUrl + 'session/' + sessionId,
        method: 'DELETE',
        headers,
      }).catch(error => progress.log(`<error disconnecting from selenium>: ${error}`));
      progress.log(`<selenium> disconnected from sessionId=${sessionId}`);
      gracefullyCloseSet.delete(disconnectFromSelenium);
    };
    gracefullyCloseSet.add(disconnectFromSelenium);

    try {
      const capabilities = value.capabilities;
      let endpointURL: URL;

      if (capabilities['se:cdp']) {
        // Selenium 4 - use built-in CDP websocket proxy.
        progress.log(`<selenium> using selenium v4`);
        const endpointURLString = addProtocol(capabilities['se:cdp']);
        endpointURL = new URL(endpointURLString);
        if (endpointURL.hostname === 'localhost' || endpointURL.hostname === '127.0.0.1')
          endpointURL.hostname = new URL(hubUrl).hostname;
        progress.log(`<selenium> retrieved endpoint ${endpointURL.toString()} for sessionId=${sessionId}`);
      } else {
        // Selenium 3 - resolve target node IP to use instead of localhost ws url.
        progress.log(`<selenium> using selenium v3`);
        const maybeChromeOptions = capabilities['goog:chromeOptions'];
        const chromeOptions = maybeChromeOptions && typeof maybeChromeOptions === 'object' ? maybeChromeOptions : undefined;
        const debuggerAddress = chromeOptions && typeof chromeOptions.debuggerAddress === 'string' ? chromeOptions.debuggerAddress : undefined;
        const chromeOptionsURL = typeof maybeChromeOptions === 'string' ? maybeChromeOptions : undefined;
        // TODO(dgozman): figure out if we can make ChromeDriver to return 127.0.0.1 instead of localhost.
        const endpointURLString = addProtocol(debuggerAddress || chromeOptionsURL).replace('localhost', '127.0.0.1');
        progress.log(`<selenium> retrieved endpoint ${endpointURLString} for sessionId=${sessionId}`);
        endpointURL = new URL(endpointURLString);
        if (endpointURL.hostname === 'localhost' || endpointURL.hostname === '127.0.0.1') {
          const sessionInfoUrl = new URL(hubUrl).origin + '/grid/api/testsession?session=' + sessionId;
          try {
            const sessionResponse = await fetchData({
              url: sessionInfoUrl,
              method: 'GET',
              timeout: progress.timeUntilDeadline(),
              headers,
            }, seleniumErrorHandler);
            const proxyId = JSON.parse(sessionResponse).proxyId;
            endpointURL.hostname = new URL(proxyId).hostname;
            progress.log(`<selenium> resolved endpoint ip ${endpointURL.toString()} for sessionId=${sessionId}`);
          } catch (e) {
            progress.log(`<selenium> unable to resolve endpoint ip for sessionId=${sessionId}, running in standalone?`);
          }
        }
      }

      return await this._connectOverCDPInternal(progress, endpointURL.toString(), {
        ...options,
        headers: headersObjectToArray(headers),
      }, disconnectFromSelenium);
    } catch (e) {
      await disconnectFromSelenium();
      throw e;
    }
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const chromeArguments = this._innerDefaultArgs(options);
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    if (options.useWebSocket)
      chromeArguments.push('--remote-debugging-port=0');
    else
      chromeArguments.push('--remote-debugging-pipe');
    if (isPersistent)
      chromeArguments.push('about:blank');
    else
      chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }

  private _innerDefaultArgs(options: types.LaunchOptions): string[] {
    const { args = [], proxy } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw this._createUserDataDirArgMisuseError('--user-data-dir');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...chromiumSwitches];

    if (os.platform() === 'darwin') {
      // See https://github.com/microsoft/playwright/issues/7362
      chromeArguments.push('--enable-use-zoom-for-dsf=false');
      // See https://bugs.chromium.org/p/chromium/issues/detail?id=1407025.
      if (options.headless)
        chromeArguments.push('--use-angle');
    }

    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      if (process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW)
        chromeArguments.push('--headless=new');
      else
        chromeArguments.push('--headless');

      chromeArguments.push(
          '--hide-scrollbars',
          '--mute-audio',
          '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
      );
    }
    if (options.chromiumSandbox !== true)
      chromeArguments.push('--no-sandbox');
    if (proxy) {
      const proxyURL = new URL(proxy.server);
      const isSocks = proxyURL.protocol === 'socks5:';
      // https://www.chromium.org/developers/design-documents/network-settings
      if (isSocks && !this.attribution.playwright.options.socksProxyPort) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
      if (this.attribution.playwright.options.socksProxyPort)
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
}

async function urlToWSEndpoint(progress: Progress, endpointURL: string, headers: { [key: string]: string; }) {
  if (endpointURL.startsWith('ws'))
    return endpointURL;
  progress.log(`<ws preparing> retrieving websocket url from ${endpointURL}`);
  const httpURL = endpointURL.endsWith('/') ? `${endpointURL}json/version/` : `${endpointURL}/json/version/`;
  const json = await fetchData({
    url: httpURL,
    headers,
  }, async (_, resp) => new Error(`Unexpected status ${resp.statusCode} when connecting to ${httpURL}.\n` +
    `This does not look like a DevTools server, try connecting via ws://.`)
  );
  return JSON.parse(json).webSocketDebuggerUrl;
}

async function seleniumErrorHandler(params: HTTPRequestParams, response: http.IncomingMessage) {
  const body = await streamToString(response);
  let message = body;
  try {
    const json = JSON.parse(body);
    message = json.value.localizedMessage || json.value.message;
  } catch (e) {
  }
  return new Error(`Error connecting to Selenium at ${params.url}: ${message}`);
}

function addProtocol(url: string) {
  if (!['ws://', 'wss://', 'http://', 'https://'].some(protocol => url.startsWith(protocol)))
    return 'http://' + url;
  return url;
}

function streamToString(stream: stream.Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function parseSeleniumRemoteParams(env: {name: string, value: string}, progress: Progress) {
  try {
    const parsed = JSON.parse(env.value);
    progress.log(`<selenium> using additional ${env.name} "${env.value}"`);
    return parsed;
  } catch (e) {
    progress.log(`<selenium> ignoring additional ${env.name} "${env.value}": ${e}`);
  }
}
