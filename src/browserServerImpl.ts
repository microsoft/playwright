/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { LaunchServerOptions, Logger } from './client/types';
import { Browser } from './server/browser';
import { EventEmitter } from 'ws';
import { Dispatcher, DispatcherScope } from './dispatchers/dispatcher';
import { BrowserContextDispatcher } from './dispatchers/browserContextDispatcher';
import * as channels from './protocol/channels';
import { BrowserServerLauncher, BrowserServer } from './client/browserType';
import { envObjectToArray } from './client/clientHelper';
import { createGuid } from './utils/utils';
import { SelectorsDispatcher } from './dispatchers/selectorsDispatcher';
import { Selectors } from './server/selectors';
import { ProtocolLogger } from './server/types';
import { CallMetadata, internalCallMetadata } from './server/instrumentation';
import { createPlaywright, Playwright } from './server/playwright';
import { PlaywrightDispatcher } from './dispatchers/playwrightDispatcher';
import { PlaywrightServer, PlaywrightServerDelegate } from './remote/playwrightServer';
import { BrowserContext } from './server/browserContext';
import { CRBrowser } from './server/chromium/crBrowser';
import { CDPSessionDispatcher } from './dispatchers/cdpSessionDispatcher';
import { PageDispatcher } from './dispatchers/pageDispatcher';

export class BrowserServerLauncherImpl implements BrowserServerLauncher {
  private _browserName: 'chromium' | 'firefox' | 'webkit';

  constructor(browserName: 'chromium' | 'firefox' | 'webkit') {
    this._browserName = browserName;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    const playwright = createPlaywright();
    if (options._acceptForwardedPorts)
      await playwright._enablePortForwarding();
    // 1. Pre-launch the browser
    const browser = await playwright[this._browserName].launch(internalCallMetadata(), {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? envObjectToArray(options.env) : undefined,
    }, toProtocolLogger(options.logger));

    // 2. Start the server
    const delegate: PlaywrightServerDelegate = {
      path: '/' + createGuid(),
      allowMultipleClients: options._acceptForwardedPorts ? false : true,
      onClose: () => {
        playwright._disablePortForwarding();
      },
      onConnect: this._onConnect.bind(this, playwright, browser),
    };
    const server = new PlaywrightServer(delegate);
    const wsEndpoint = await server.listen(options.port);

    // 3. Return the BrowserServer interface
    const browserServer = new EventEmitter() as (BrowserServer & EventEmitter);
    browserServer.process = () => browser.options.browserProcess.process!;
    browserServer.wsEndpoint = () => wsEndpoint;
    browserServer.close = () => browser.options.browserProcess.close();
    browserServer.kill = () => browser.options.browserProcess.kill();
    (browserServer as any)._disconnectForTest = () => server.close();
    browser.options.browserProcess.onclose = async (exitCode, signal) => {
      server.close();
      browserServer.emit('close', exitCode, signal);
    };
    return browserServer;
  }

  private async _onConnect(playwright: Playwright, browser: Browser, scope: DispatcherScope, forceDisconnect: () => void) {
    const selectors = new Selectors();
    const selectorsDispatcher = new SelectorsDispatcher(scope, selectors);
    const browserDispatcher = new ConnectedBrowserDispatcher(scope, browser, selectors);
    browser.on(Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      forceDisconnect();
    });
    new PlaywrightDispatcher(scope, playwright, selectorsDispatcher, browserDispatcher);
    return () => {
      // Cleanup contexts upon disconnect.
      browserDispatcher.cleanupContexts().catch(e => {});
    };
  }
}

// This class implements multiplexing browser dispatchers over a single Browser instance.
class ConnectedBrowserDispatcher extends Dispatcher<Browser, channels.BrowserInitializer> implements channels.BrowserChannel {
  private _contexts = new Set<BrowserContext>();
  private _selectors: Selectors;

  constructor(scope: DispatcherScope, browser: Browser, selectors: Selectors) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser.options.name }, true);
    this._selectors = selectors;
  }

  async newContext(params: channels.BrowserNewContextParams, metadata: CallMetadata): Promise<channels.BrowserNewContextResult> {
    if (params.recordVideo)
      params.recordVideo.dir = this._object.options.artifactsDir;
    const context = await this._object.newContext(params);
    this._contexts.add(context);
    context._setSelectors(this._selectors);
    context.on(BrowserContext.Events.Close, () => this._contexts.delete(context));
    if (params.storageState)
      await context.setStorageState(metadata, params.storageState);
    return { context: new BrowserContextDispatcher(this._scope, context) };
  }

  async close(): Promise<void> {
    // Client should not send us Browser.close.
  }

  async killForTests(): Promise<void> {
    // Client should not send us Browser.killForTests.
  }

  async newBrowserCDPSession(): Promise<channels.BrowserNewBrowserCDPSessionResult> {
    if (!this._object.options.isChromium)
      throw new Error(`CDP session is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    return { session: new CDPSessionDispatcher(this._scope, await crBrowser.newBrowserCDPSession()) };
  }

  async startTracing(params: channels.BrowserStartTracingParams): Promise<void> {
    if (!this._object.options.isChromium)
      throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    await crBrowser.startTracing(params.page ? (params.page as PageDispatcher)._object : undefined, params);
  }

  async stopTracing(): Promise<channels.BrowserStopTracingResult> {
    if (!this._object.options.isChromium)
      throw new Error(`Tracing is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    const buffer = await crBrowser.stopTracing();
    return { binary: buffer.toString('base64') };
  }

  async cleanupContexts() {
    await Promise.all(Array.from(this._contexts).map(context => context.close(internalCallMetadata())));
  }
}

function toProtocolLogger(logger: Logger | undefined): ProtocolLogger | undefined {
  return logger ? (direction: 'send' | 'receive', message: object) => {
    if (logger.isEnabled('protocol', 'verbose'))
      logger.log('protocol', 'verbose', (direction === 'send' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(message), [], {});
  } : undefined;
}
