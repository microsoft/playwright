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
import type * as channels from '@protocol/channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { existingDispatcher } from './dispatcher';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';
import type { CRBrowser } from '../chromium/crBrowser';
import type { PageDispatcher } from './pageDispatcher';
import type { CallMetadata } from '../instrumentation';
import { BrowserContext } from '../browserContext';
import { Selectors } from '../selectors';
import type { BrowserTypeDispatcher } from './browserTypeDispatcher';
import { ArtifactDispatcher } from './artifactDispatcher';

export class BrowserDispatcher extends Dispatcher<Browser, channels.BrowserChannel, BrowserTypeDispatcher> implements channels.BrowserChannel {
  _type_Browser = true;

  constructor(scope: BrowserTypeDispatcher, browser: Browser) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser.options.name });
    this.addObjectListener(Browser.Events.Disconnected, () => this._didClose());
  }

  _didClose() {
    this._dispatchEvent('close');
    this._dispose();
  }

  async newContext(params: channels.BrowserNewContextParams, metadata: CallMetadata): Promise<channels.BrowserNewContextResult> {
    const context = await this._object.newContext(metadata, params);
    return { context: new BrowserContextDispatcher(this, context) };
  }

  async newContextForReuse(params: channels.BrowserNewContextForReuseParams, metadata: CallMetadata): Promise<channels.BrowserNewContextForReuseResult> {
    return await newContextForReuse(this._object, this, params, null, metadata);
  }

  async stopPendingOperations(params: channels.BrowserStopPendingOperationsParams, metadata: CallMetadata): Promise<channels.BrowserStopPendingOperationsResult> {
    await this._object.stopPendingOperations(params.reason);
  }

  async close(params: channels.BrowserCloseParams, metadata: CallMetadata): Promise<void> {
    metadata.potentiallyClosesScope = true;
    await this._object.close(params);
  }

  async killForTests(_: any, metadata: CallMetadata): Promise<void> {
    metadata.potentiallyClosesScope = true;
    await this._object.killForTests();
  }

  async defaultUserAgentForTest(): Promise<channels.BrowserDefaultUserAgentForTestResult> {
    return { userAgent: this._object.userAgent() };
  }

  async newBrowserCDPSession(): Promise<channels.BrowserNewBrowserCDPSessionResult> {
    if (!this._object.options.isChromium)
      throw new Error(`CDP session is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    return { session: new CDPSessionDispatcher(this, await crBrowser.newBrowserCDPSession()) };
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
    return { artifact: ArtifactDispatcher.from(this, await crBrowser.stopTracing()) };
  }
}

// This class implements multiplexing browser dispatchers over a single Browser instance.
export class ConnectedBrowserDispatcher extends Dispatcher<Browser, channels.BrowserChannel, RootDispatcher> implements channels.BrowserChannel {
  _type_Browser = true;
  private _contexts = new Set<BrowserContext>();
  readonly selectors: Selectors;

  constructor(scope: RootDispatcher, browser: Browser) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser.options.name });
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
    return { context: new BrowserContextDispatcher(this, context) };
  }

  async newContextForReuse(params: channels.BrowserNewContextForReuseParams, metadata: CallMetadata): Promise<channels.BrowserNewContextForReuseResult> {
    return await newContextForReuse(this._object, this as any as BrowserDispatcher, params, this.selectors, metadata);
  }

  async stopPendingOperations(params: channels.BrowserStopPendingOperationsParams, metadata: CallMetadata): Promise<channels.BrowserStopPendingOperationsResult> {
    await this._object.stopPendingOperations(params.reason);
  }

  async close(): Promise<void> {
    // Client should not send us Browser.close.
  }

  async killForTests(): Promise<void> {
    // Client should not send us Browser.killForTests.
  }

  async defaultUserAgentForTest(): Promise<channels.BrowserDefaultUserAgentForTestResult> {
    throw new Error('Client should not send us Browser.defaultUserAgentForTest');
  }

  async newBrowserCDPSession(): Promise<channels.BrowserNewBrowserCDPSessionResult> {
    if (!this._object.options.isChromium)
      throw new Error(`CDP session is only available in Chromium`);
    const crBrowser = this._object as CRBrowser;
    return { session: new CDPSessionDispatcher(this as any as BrowserDispatcher, await crBrowser.newBrowserCDPSession()) };
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
    return { artifact: ArtifactDispatcher.from(this, await crBrowser.stopTracing()) };
  }

  async cleanupContexts() {
    await Promise.all(Array.from(this._contexts).map(context => context.close({ reason: 'Global context cleanup (connection terminated)' })));
  }
}

async function newContextForReuse(browser: Browser, scope: BrowserDispatcher, params: channels.BrowserNewContextForReuseParams, selectors: Selectors | null, metadata: CallMetadata): Promise<channels.BrowserNewContextForReuseResult> {
  const { context, needsReset } = await browser.newContextForReuse(params, metadata);
  if (needsReset) {
    const oldContextDispatcher = existingDispatcher<BrowserContextDispatcher>(context);
    if (oldContextDispatcher)
      oldContextDispatcher._dispose();
    await context.resetForReuse(metadata, params);
  }
  if (selectors)
    context.setSelectors(selectors);
  const contextDispatcher = new BrowserContextDispatcher(scope, context);
  return { context: contextDispatcher };
}
