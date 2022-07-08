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

import { Browser } from '../browser';
import type * as channels from '../../protocol/channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { existingDispatcher } from './dispatcher';
import type { DispatcherScope } from './dispatcher';
import { Dispatcher } from './dispatcher';
import type { CRBrowser } from '../chromium/crBrowser';
import type { PageDispatcher } from './pageDispatcher';
import type { CallMetadata } from '../instrumentation';
import { serverSideCallMetadata } from '../instrumentation';
import { BrowserContext } from '../browserContext';
import { Selectors } from '../selectors';

export class BrowserDispatcher extends Dispatcher<Browser, channels.BrowserChannel> implements channels.BrowserChannel {
  _type_Browser = true;
  private _contextForReuse: { context: BrowserContext, hash: string } | undefined;

  constructor(scope: DispatcherScope, browser: Browser) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser.options.name }, true);
    this.addObjectListener(Browser.Events.Disconnected, () => this._didClose());
  }

  _didClose() {
    this._dispatchEvent('close');
    this._dispose();
  }

  async newContext(params: channels.BrowserNewContextParams, metadata: CallMetadata): Promise<channels.BrowserNewContextResult> {
    const context = await this._object.newContext(metadata, params);
    return { context: new BrowserContextDispatcher(this._scope, context) };
  }

  /**
   * Used for inner loop scenarios where user would like to preserve the browser window, opened page and devtools instance.
   */
  async newContextForReuse(params: channels.BrowserNewContextForReuseParams, metadata: CallMetadata): Promise<channels.BrowserNewContextForReuseResult> {
    const hash = BrowserContext.reusableContextHash(params);
    if (!this._contextForReuse || hash !== this._contextForReuse.hash || !this._contextForReuse.context.canResetForReuse()) {
      if (this._contextForReuse)
        await this._contextForReuse.context.close(metadata);
      this._contextForReuse = { context: await this._object.newContext(metadata, params), hash };
    } else {
      const oldContextDispatcher = existingDispatcher<BrowserContextDispatcher>(this._contextForReuse.context);
      oldContextDispatcher._dispose();
      await this._contextForReuse.context.resetForReuse(metadata, params);
    }
    const context = new BrowserContextDispatcher(this._scope, this._contextForReuse.context);
    return { context };
  }

  async close(): Promise<void> {
    await this._object.close();
  }

  async killForTests(): Promise<void> {
    await this._object.killForTests();
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
    return { binary: await crBrowser.stopTracing() };
  }
}

// This class implements multiplexing browser dispatchers over a single Browser instance.
export class ConnectedBrowserDispatcher extends Dispatcher<Browser, channels.BrowserChannel> implements channels.BrowserChannel {
  _type_Browser = true;
  private _contexts = new Set<BrowserContext>();
  readonly selectors: Selectors;

  constructor(scope: DispatcherScope, browser: Browser) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser.options.name }, true);
    // When we have a remotely-connected browser, each client gets a fresh Selector instance,
    // so that two clients do not interfere between each other.
    this.selectors = new Selectors();
  }

  async newContext(params: channels.BrowserNewContextParams, metadata: CallMetadata): Promise<channels.BrowserNewContextResult> {
    if (params.recordVideo)
      params.recordVideo.dir = this._object.options.artifactsDir;
    const context = await this._object.newContext(metadata, params);
    this._contexts.add(context);
    context.setSelectors(this.selectors);
    context.on(BrowserContext.Events.Close, () => this._contexts.delete(context));
    return { context: new BrowserContextDispatcher(this._scope, context) };
  }

  newContextForReuse(params: channels.BrowserNewContextForReuseParams, metadata?: channels.Metadata | undefined): Promise<channels.BrowserNewContextForReuseResult> {
    throw new Error('Method not implemented.');
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
    return { binary: await crBrowser.stopTracing() };
  }

  async cleanupContexts() {
    await Promise.all(Array.from(this._contexts).map(context => context.close(serverSideCallMetadata())));
  }
}
