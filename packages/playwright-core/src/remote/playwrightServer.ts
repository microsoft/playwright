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

import { PlaywrightConnection } from './playwrightConnection';
import { createPlaywright } from '../server/playwright';
import { Semaphore } from '../utils/isomorphic/semaphore';
import { DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT } from '../utils/isomorphic/time';
import { WSServer } from '../server/utils/wsServer';
import { wrapInASCIIBox } from '../server/utils/ascii';
import { getPlaywrightVersion } from '../server/utils/userAgent';
import { serverSideCallMetadata } from '../server';
import { Browser } from '../server/browser';

import type http from 'http';
import type { ClientType } from './playwrightConnection';
import type { SocksProxy } from '../server/utils/socksProxy';
import type { AndroidDevice } from '../server/android/android';
import type { Playwright } from '../server/playwright';
import type  { LaunchOptions } from '../server/types';


type ServerOptions = {
  path: string;
  maxConnections: number;
  mode: 'default' | 'launchServer' | 'launchServerShared' | 'extension';
  preLaunchedBrowser?: Browser;
  preLaunchedAndroidDevice?: AndroidDevice;
  preLaunchedSocksProxy?: SocksProxy;
  browserServer?: boolean;
};

interface LaunchRequest {
  browserName: 'chromium' | 'firefox' | 'webkit';
  launchOptions: LaunchOptions;
  reuseGroup?: string;
  userDataDir?: string;
}

export class PlaywrightServer {
  private _playwright: Playwright;
  private _options: ServerOptions;
  private _wsServer: WSServer;

  private _nonTestingBrowsers = new Map<Browser, { reuseGroup?: string }>();

  constructor(options: ServerOptions) {
    this._options = options;
    if (options.preLaunchedBrowser)
      this._playwright = options.preLaunchedBrowser.attribution.playwright;
    if (options.preLaunchedAndroidDevice)
      this._playwright = options.preLaunchedAndroidDevice._android.attribution.playwright;
    this._playwright ??= createPlaywright({ sdkLanguage: 'javascript', isServer: true });

    const browserSemaphore = new Semaphore(this._options.maxConnections);
    const controllerSemaphore = new Semaphore(1);
    const reuseBrowserSemaphore = new Semaphore(1);

    this._wsServer = new WSServer({
      onRequest: async (request, response) => {
        if (!options.browserServer) {
          if (request.method === 'GET' && request.url === '/json') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              wsEndpointPath: this._options.path,
            }));
            return;
          }

          response.end('Running');
          return;
        }

        if (request.method === 'GET' && request.url === '/json/list') {
          const browsers = this._playwright.allBrowsers().map(browser => this._browserToJSON(browser));
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(browsers));
          return;
        }

        if (request.method === 'POST' && request.url === '/json/launch') {
          const params = await readBodyJSON(request) as LaunchRequest;
          const browserType = this._playwright[params.browserName];
          const callMetadata = serverSideCallMetadata();

          let browser: Browser | undefined;
          if (params.reuseGroup)
            browser = this._playwright.allBrowsers().find(b => b.options.name === params.browserName && this._nonTestingBrowsers.get(b)?.reuseGroup === params.reuseGroup);
          if (!browser) {
            if (params.userDataDir) {
              const context = await browserType.launchPersistentContext(callMetadata, params.userDataDir, params.launchOptions);
              browser = context._browser;
            } else {
              browser = await browserType.launch(callMetadata, params.launchOptions);
            }
          }

          this._nonTestingBrowsers.set(browser, { reuseGroup: params.reuseGroup });
          browser.on(Browser.Events.Disconnected, () => this._nonTestingBrowsers.delete(browser));

          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(this._browserToJSON(browser)));
          return;
        }

        response.end('Running');
      },

      onUpgrade: (request, socket) => {
        const url = new URL('http://localhost' + request.url!);

        const hasFullAccess = url.pathname === this._options.path;
        const hasScopedAccess = !!options.browserServer && this._playwright.allBrowsers().some(browser => browser.guid === url.searchParams.get('browserGuid'));
        if (!hasFullAccess && !hasScopedAccess)
          return { error: `HTTP/${request.httpVersion} 400 Bad Request\r\n\r\n` };

        const uaError = userAgentVersionMatchesErrorMessage(request.headers['user-agent'] || '');
        if (uaError)
          return { error: `HTTP/${request.httpVersion} 428 Precondition Required\r\n\r\n${uaError}` };
      },

      onHeaders: headers => {
        if (process.env.PWTEST_SERVER_WS_HEADERS)
          headers.push(process.env.PWTEST_SERVER_WS_HEADERS!);
      },

      onConnection: (request, url, ws, id) => {
        const browserHeader = request.headers['x-playwright-browser'];
        const browserName = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
        const proxyHeader = request.headers['x-playwright-proxy'];
        const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);
        const browserGuid = options.browserServer ? url.searchParams.get('browserGuid') : null;

        const launchOptionsHeader = request.headers['x-playwright-launch-options'] || '';
        const launchOptionsHeaderValue = Array.isArray(launchOptionsHeader) ? launchOptionsHeader[0] : launchOptionsHeader;
        const launchOptionsParam = url.searchParams.get('launch-options');
        let launchOptions: LaunchOptions = { timeout: DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT };
        try {
          launchOptions = JSON.parse(launchOptionsParam || launchOptionsHeaderValue);
        } catch (e) {
        }

        // Instantiate playwright for the extension modes.
        const isExtension = this._options.mode === 'extension';
        let clientType: ClientType = 'launch-browser';
        let semaphore: Semaphore = browserSemaphore;
        let browser: Browser | undefined;
        let sharedBrowser = this._options.mode === 'launchServerShared';
        if (browserGuid) {
          clientType = 'pre-launched-browser-or-android';
          semaphore = browserSemaphore;
          sharedBrowser = true;
          browser = this._playwright.allBrowsers().find(b => b.guid === browserGuid);
          if (!browser)
            throw new Error(`Browser not found.`);
        } else if (isExtension && url.searchParams.has('debug-controller')) {
          clientType = 'controller';
          semaphore = controllerSemaphore;
        } else if (isExtension) {
          clientType = 'reuse-browser';
          semaphore = reuseBrowserSemaphore;
        } else if (this._options.mode === 'launchServer' || this._options.mode === 'launchServerShared') {
          clientType = 'pre-launched-browser-or-android';
          semaphore = browserSemaphore;
          browser = this._options.preLaunchedBrowser;
        }

        return new PlaywrightConnection(
            semaphore.acquire(),
            clientType, ws,
            {
              socksProxyPattern: proxyValue,
              browserName,
              launchOptions,
              allowFSPaths: this._options.mode === 'extension',
              sharedBrowser,
            },
            this._playwright,
            {
              browser,
              androidDevice: this._options.preLaunchedAndroidDevice,
              socksProxy: this._options.preLaunchedSocksProxy,
            },
            id,
            browser => this._nonTestingBrowsers.has(browser),
            () => semaphore.release(),
        );
      },
    });
  }

  async listen(port: number = 0, hostname?: string): Promise<string> {
    return this._wsServer.listen(port, hostname, this._options.path);
  }

  async close() {
    await this._wsServer.close();
  }

  private _browserToJSON(browser: Browser) {
    return {
      browserName: browser.options.name,
      launchOptions: browser.options.originalLaunchOptions,
      reuseGroup: this._nonTestingBrowsers.get(browser)?.reuseGroup,
      wsPath: '?' + new URLSearchParams({ browserGuid: browser.guid }),
      contexts: browser.contexts().map(context => ({
        pages: context.pages().map(page => ({
          url: page.mainFrame().url()
        })),
      })),
    };
  }
}

function userAgentVersionMatchesErrorMessage(userAgent: string) {
  const match = userAgent.match(/^Playwright\/(\d+\.\d+\.\d+)/);
  if (!match) {
    // Cannot parse user agent - be lax.
    return;
  }
  const received = match[1].split('.').slice(0, 2).join('.');
  const expected = getPlaywrightVersion(true);
  if (received !== expected) {
    return wrapInASCIIBox([
      `Playwright version mismatch:`,
      `  - server version: v${expected}`,
      `  - client version: v${received}`,
      ``,
      `If you are using VSCode extension, restart VSCode.`,
      ``,
      `If you are connecting to a remote service,`,
      `keep your local Playwright version in sync`,
      `with the remote service version.`,
      ``,
      `<3 Playwright Team`
    ].join('\n'), 1);
  }
}


async function readBody(request: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function readBodyJSON(request: http.IncomingMessage): Promise<any> {
  const body = await readBody(request);
  try {
    return JSON.parse(body.toString());
  } catch (e) {
    throw new Error(`Failed to parse JSON body: ${e.message}`);
  }
}
