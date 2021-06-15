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
import { CRBrowser } from './crBrowser';
import { Env } from '../processLauncher';
import { kBrowserCloseMessageId } from './crConnection';
import { rewriteErrorMessage } from '../../utils/stackTrace';
import { BrowserType } from '../browserType';
import { ConnectionTransport, ProtocolRequest, WebSocketTransport } from '../transport';
import { CRDevTools } from './crDevTools';
import { BrowserOptions, BrowserProcess, PlaywrightOptions } from '../browser';
import * as types from '../types';
import { assert, debugMode, headersArrayToObject, removeFolders } from '../../utils/utils';
import { RecentLogsCollector } from '../../utils/debugLogger';
import { ProgressController } from '../progress';
import { TimeoutSettings } from '../../utils/timeoutSettings';
import { helper } from '../helper';
import { CallMetadata } from '../instrumentation';
import { findChromiumChannel } from './findChromiumChannel';
import http from 'http';

const ARTIFACTS_FOLDER = path.join(os.tmpdir(), 'playwright-artifacts-');

export class Chromium extends BrowserType {
  private _devtools: CRDevTools | undefined;

  constructor(playwrightOptions: PlaywrightOptions) {
    super('chromium', playwrightOptions);

    if (debugMode())
      this._devtools = this._createDevTools();
  }

  executablePath(channel?: string): string {
    if (channel) {
      let executablePath = undefined;
      if ((channel as any) === 'chromium-with-symbols')
        executablePath = this._registry.executablePath('chromium-with-symbols');
      else
        executablePath = findChromiumChannel(channel);
      assert(executablePath, `unsupported chromium channel "${channel}"`);
      assert(fs.existsSync(executablePath), `"${channel}" channel is not installed. Try running 'npx playwright install ${channel}'`);
      return executablePath;
    }
    return super.executablePath(channel);
  }

  async connectOverCDP(metadata: CallMetadata, endpointURL: string, options: { slowMo?: number, sdkLanguage: string, headers?: types.HeadersArray }, timeout?: number) {
    const controller = new ProgressController(metadata, this);
    controller.setLogName('browser');
    const browserLogsCollector = new RecentLogsCollector();
    return controller.run(async progress => {
      let headersMap: { [key: string]: string; } | undefined;
      if (options.headers)
        headersMap = headersArrayToObject(options.headers, false);

      const artifactsDir = await fs.promises.mkdtemp(ARTIFACTS_FOLDER);
  
      const chromeTransport = await WebSocketTransport.connect(progress, await urlToWSEndpoint(endpointURL), headersMap);
      const browserProcess: BrowserProcess = {
        close: async () => {
          await removeFolders([ artifactsDir ]);
          await chromeTransport.closeAndWait();
        },
        kill: async () => {
          await removeFolders([ artifactsDir ]);
          await chromeTransport.closeAndWait();
        }
      };
      const browserOptions: BrowserOptions = {
        ...this._playwrightOptions,
        slowMo: options.slowMo,
        name: 'chromium',
        isChromium: true,
        persistent: { sdkLanguage: options.sdkLanguage, noDefaultViewport: true },
        browserProcess,
        protocolLogger: helper.debugProtocolLogger(),
        browserLogsCollector,
        artifactsDir,
        downloadsPath: artifactsDir,
        tracesDir: artifactsDir
      };
      return await CRBrowser.connect(chromeTransport, browserOptions);
    }, TimeoutSettings.timeout({timeout}));
  }

  private _createDevTools() {
    return new CRDevTools(path.join(this._registry.browserDirectory('chromium'), 'devtools-preferences.json'));
  }

  async _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<CRBrowser> {
    let devtools = this._devtools;
    if ((options as any).__testHookForDevTools) {
      devtools = this._createDevTools();
      await (options as any).__testHookForDevTools(devtools);
    }
    return CRBrowser.connect(transport, options, devtools);
  }

  _rewriteStartupError(error: Error): Error {
    // These error messages are taken from Chromium source code as of July, 2020:
    // https://github.com/chromium/chromium/blob/70565f67e79f79e17663ad1337dc6e63ee207ce9/content/browser/zygote_host/zygote_host_impl_linux.cc
    if (!error.message.includes('crbug.com/357670') && !error.message.includes('No usable sandbox!') && !error.message.includes('crbug.com/638180'))
      return error;
    return rewriteErrorMessage(error, [
      `Chromium sandboxing failed!`,
      `================================`,
      `To workaround sandboxing issues, do either of the following:`,
      `  - (preferred): Configure environment to support sandboxing: https://github.com/microsoft/playwright/blob/master/docs/troubleshooting.md`,
      `  - (alternative): Launch Chromium without sandbox using 'chromiumSandbox: false' option`,
      `================================`,
      ``,
    ].join('\n'));
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return env;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
    transport.send(message);
  }

  _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], proxy } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter to `browserType.launchPersistentContext(userDataDir, ...)` instead of specifying --user-data-dir argument');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...DEFAULT_ARGS];
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    if (options.useWebSocket)
      chromeArguments.push('--remote-debugging-port=0');
    else
      chromeArguments.push('--remote-debugging-pipe');
    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      chromeArguments.push(
          '--headless',
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
      if (isSocks) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
      if (this._playwrightOptions.loopbackProxyOverride)
        proxyBypassRules.push('<-loopback>');
      if (proxy.bypass)
        proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
      if (proxyBypassRules.length > 0)
        chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
    }
    chromeArguments.push(...args);
    if (isPersistent)
      chromeArguments.push('about:blank');
    else
      chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }
}

const DEFAULT_ARGS = [
  '--disable-background-networking',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  // BlinkGenPropertyTrees disabled due to crbug.com/937609
  '--disable-features=TranslateUI,BlinkGenPropertyTrees,ImprovedCookieControls,SameSiteByDefaultCookies,LazyFrameLoading,GlobalMediaControls',
  '--allow-pre-commit-input',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
  // See https://chromium-review.googlesource.com/c/chromium/src/+/2436773
  '--no-service-autorun',
];

async function urlToWSEndpoint(endpointURL: string) {
  if (endpointURL.startsWith('ws'))
    return endpointURL;
  const httpURL = endpointURL.endsWith('/') ? `${endpointURL}json/version/` : `${endpointURL}/json/version/`;
  const json = await new Promise<string>((resolve, reject) => {
    http.get(httpURL, resp => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => resolve(data));
    }).on('error', reject);
  });
  return JSON.parse(json).webSocketDebuggerUrl;
}
