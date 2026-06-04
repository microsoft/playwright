/**
 * Copyright (c) Microsoft Corporation.
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

import { ChildProcess, spawn } from 'child_process';
import net from 'net';
import os from 'os';
import path from 'path';

import { RecentLogsCollector } from '@utils/debugLogger';
import { removeFolders } from '@utils/fileUtils';
import { Browser } from '../../browser';
import { BrowserContext } from '../../browserContext';
import { helper } from '../../helper';
import * as network from '../../network';
import { WDConnection, WDSession } from './wdConnection';
import { WDPage } from './wdPage';

import type { BrowserOptions, BrowserProcess } from '../../browser';
import type { SdkObject } from '../../instrumentation';
import type { InitScript, Page } from '../../page';
import type { Progress } from '../../progress';
import type * as types from '../../types';
import type * as channels from '@protocol/channels';

const kLaunchScheme = 'webdriver+launch://';

// Translates a `webdriver://host:port` endpoint into an `http://host:port` base.
function toHttpBase(endpointURL: string): string {
  return endpointURL.replace(/^webdriver:\/\//, 'http://');
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function launchSafariDriver(logs: RecentLogsCollector): Promise<{ baseURL: string, process: ChildProcess }> {
  const port = await findFreePort();
  const proc = spawn('safaridriver', ['--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout?.on('data', d => logs.log(`[safaridriver] ${String(d).trim()}`));
  proc.stderr?.on('data', d => logs.log(`[safaridriver] ${String(d).trim()}`));
  proc.on('error', e => logs.log(`[safaridriver] failed to spawn: ${e.message}`));
  return { baseURL: `http://localhost:${port}`, process: proc };
}

async function waitForReady(baseURL: string, progress: Progress): Promise<void> {
  await progress.race((async () => {
    for (;;) {
      try {
        const res = await fetch(`${baseURL}/status`);
        if (res.ok) {
          const json = await res.json() as { value?: { ready?: boolean } };
          if (json?.value?.ready !== false)
            return;
        }
      } catch {
        // safaridriver not accepting connections yet — retry.
      }
      await new Promise(f => setTimeout(f, 100));
    }
  })());
}

export async function connectOverWebDriver(progress: Progress, parent: SdkObject, params: channels.BrowserTypeConnectOverCDPParams): Promise<Browser> {
  const endpointURL = params.endpointURL || '';
  const browserLogsCollector = new RecentLogsCollector();

  const artifactsDir = params.artifactsDir ?? path.join(os.tmpdir(), 'playwright-artifacts-');
  const doCleanup = async () => {
    await removeFolders([artifactsDir]);
  };

  const browser = await progress.race((async () => {
    let baseURL: string;
    let driverProcess: ChildProcess | undefined;
    if (endpointURL.startsWith(kLaunchScheme)) {
      const launched = await launchSafariDriver(browserLogsCollector);
      baseURL = launched.baseURL;
      driverProcess = launched.process;
    } else {
      baseURL = toHttpBase(endpointURL);
    }
    await waitForReady(baseURL, progress);

    const connection = new WDConnection(baseURL, helper.debugProtocolLogger(), browserLogsCollector);
    const session = await WDSession.create(connection, { alwaysMatch: { browserName: 'safari' } });

    const created = new WDBrowser(parent, connection, session, {
      slowMo: params.slowMo,
      name: 'webkit',
      browserType: 'webkit',
      browserProcess: { close: async () => {}, kill: async () => {} } as BrowserProcess,
      protocolLogger: helper.debugProtocolLogger(),
      browserLogsCollector,
      artifactsDir,
      downloadsPath: artifactsDir,
      tracesDir: artifactsDir,
      originalLaunchOptions: {},
    });
    const shutdown = async () => {
      await session.delete().catch(() => {});
      connection.close();
      driverProcess?.kill('SIGTERM');
      await doCleanup();
      // Signal disconnection so Browser.close() (and remote clients) settle.
      created._browserClosed();
    };
    created.options.browserProcess = { close: shutdown, kill: shutdown };
    await created._initialize();
    return created;
  })());

  if (!params.isLocal)
    browser._isBrowserCollocatedWithServer = false;
  browser.on(Browser.Events.Disconnected, doCleanup);
  return browser;
}

export class WDBrowser extends Browser {
  readonly _context: WDBrowserContext;
  readonly _connection: WDConnection;
  readonly _session: WDSession;
  _page!: WDPage;
  private _didCloseFired = false;

  constructor(parent: SdkObject, connection: WDConnection, session: WDSession, options: BrowserOptions) {
    super(parent, options);
    this._connection = connection;
    this._session = session;
    this._context = new WDBrowserContext(this);
  }

  async _initialize(): Promise<void> {
    await this._context.initialize();
    this._page = new WDPage(this._context, this._session);
    await this._page._initialize();
    await this._page.waitForInitialized();
  }

  async doCreateNewContext(options: types.BrowserContextOptions): Promise<BrowserContext> {
    throw new Error('Creating new contexts is not supported over WebDriver.');
  }

  contexts(): BrowserContext[] {
    return [this._context];
  }

  version(): string {
    return '';
  }

  userAgent(): string {
    return '';
  }

  isConnected(): boolean {
    return !this._connection.isClosed();
  }

  _browserClosed(): void {
    if (this._didCloseFired)
      return;
    this._didCloseFired = true;
    this.didClose();
  }
}

export class WDBrowserContext extends BrowserContext {
  declare readonly _browser: WDBrowser;

  constructor(browser: WDBrowser) {
    super(browser, {}, '');
  }

  private _session(): WDSession {
    return this._browser._session;
  }

  override possiblyUninitializedPages(): Page[] {
    return this._browser._page ? [this._browser._page._page] : [];
  }

  override async doCreateNewPage(): Promise<Page> {
    throw new Error('Creating new pages is not supported over WebDriver.');
  }

  async doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]> {
    const raw = await this._session().getCookies().catch(() => [] as any[]);
    const cookies: channels.NetworkCookie[] = raw.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '',
      path: c.path || '/',
      expires: typeof c.expiry === 'number' ? c.expiry : -1,
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      sameSite: (c.sameSite as channels.NetworkCookie['sameSite']) || 'None',
    }));
    return network.filterCookies(cookies, urls);
  }

  async addCookies(cookies: channels.SetNetworkCookie[]) {
    for (const c of network.rewriteCookies(cookies)) {
      // WebDriver only sets cookies for the active document's domain — best effort.
      await this._session().addCookie({
        name: c.name,
        value: c.value,
        path: c.path,
        domain: c.domain,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        expiry: c.expires && c.expires !== -1 ? Math.ceil(c.expires) : undefined,
      }).catch(() => {});
    }
  }

  async doClearCookies() {
    await this._session().deleteAllCookies();
  }

  async doUpdateExtraHTTPHeaders(): Promise<void> {}
  async doUpdateOffline(): Promise<void> {}
  async doUpdateRequestInterception(): Promise<void> {}
  async doUpdateDefaultViewport(): Promise<void> {}
  async doUpdateDefaultEmulatedMedia(): Promise<void> {}
  override async doExposePlaywrightBinding(): Promise<void> {}
  override async onClosePersistent(): Promise<void> {}

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async doGrantPermissions(origin: string, permissions: string[]) {
    throw new Error('Method not implemented.');
  }

  async doClearPermissions() {
    throw new Error('Method not implemented.');
  }

  async doAddInitScript(initScript: InitScript) {
    throw new Error('Method not implemented.');
  }

  async doRemoveInitScripts(initScripts: InitScript[]) {
    throw new Error('Method not implemented.');
  }

  override async clearCache(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override async doClose(reason: string | undefined): Promise<void> {
    throw new Error('Method not implemented.');
  }

  override async cancelDownload(uuid: string) {
    throw new Error('Method not implemented.');
  }

  override async setUserAgent(userAgent: string | undefined): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected override async doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
