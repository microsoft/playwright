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
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { Dispatcher } from './dispatcher';
import { BrowserContext } from '../browserContext';
import { ArtifactDispatcher } from './artifactDispatcher';

import type { BrowserTypeDispatcher } from './browserTypeDispatcher';
import type { PageDispatcher } from './pageDispatcher';
import type { CRBrowser } from '../chromium/crBrowser';
import type { CallMetadata } from '../instrumentation';
import type * as channels from '@protocol/channels';

type BrowserDispatcherOptions = {
  // Do not allow to close this browser.
  ignoreStopAndKill?: boolean,
  // Only expose browser contexts created by this dispatcher. By default, all contexts are exposed.
  isolateContexts?: boolean,
};

export class BrowserDispatcher extends Dispatcher<Browser, channels.BrowserChannel, BrowserTypeDispatcher> implements channels.BrowserChannel {
  _type_Browser = true;
  private _options: BrowserDispatcherOptions;
  private _isolatedContexts = new Set<BrowserContext>();

  constructor(scope: BrowserTypeDispatcher, browser: Browser, options: BrowserDispatcherOptions = {}) {
    super(scope, browser, 'Browser', { version: browser.version(), name: browser.options.name });
    this._options = options;

    if (!options.isolateContexts) {
      this.addObjectListener(Browser.Events.Context, (context: BrowserContext) => this._dispatchEvent('context', { context: BrowserContextDispatcher.from(this, context) }));
      this.addObjectListener(Browser.Events.Disconnected, () => this._didClose());
      if (browser._defaultContext)
        this._dispatchEvent('context', { context: BrowserContextDispatcher.from(this, browser._defaultContext) });
      for (const context of browser.contexts())
        this._dispatchEvent('context', { context: BrowserContextDispatcher.from(this, context) });
    }
  }

  _didClose() {
    this._dispatchEvent('close');
    this._dispose();
  }

  async newContext(params: channels.BrowserNewContextParams, metadata: CallMetadata): Promise<channels.BrowserNewContextResult> {
    if (!this._options.isolateContexts) {
      const context = await this._object.newContext(metadata, params);
      const contextDispatcher = BrowserContextDispatcher.from(this, context);
      return { context: contextDispatcher };
    }

    if (params.recordVideo)
      params.recordVideo.dir = this._object.options.artifactsDir;
    const context = await this._object.newContext(metadata, params);
    this._isolatedContexts.add(context);
    context.on(BrowserContext.Events.Close, () => this._isolatedContexts.delete(context));
    const contextDispatcher = BrowserContextDispatcher.from(this, context);
    this._dispatchEvent('context', { context: contextDispatcher });
    return { context: contextDispatcher };
  }

  async newContextForReuse(params: channels.BrowserNewContextForReuseParams, metadata: CallMetadata): Promise<channels.BrowserNewContextForReuseResult> {
    const { context, needsReset } = await this._object.newContextForReuse(params, metadata);
    if (needsReset) {
      const oldContextDispatcher = this.connection.existingDispatcher<BrowserContextDispatcher>(context);
      if (oldContextDispatcher)
        oldContextDispatcher._dispose();
      await context.resetForReuse(metadata, params);
    }
    const contextDispatcher = BrowserContextDispatcher.from(this, context);
    this._dispatchEvent('context', { context: contextDispatcher });
    return { context: contextDispatcher };
  }

  async stopPendingOperations(params: channels.BrowserStopPendingOperationsParams, metadata: CallMetadata): Promise<channels.BrowserStopPendingOperationsResult> {
    await this._object.stopPendingOperations(params.reason);
  }

  async close(params: channels.BrowserCloseParams, metadata: CallMetadata): Promise<void> {
    if (this._options.ignoreStopAndKill)
      return;
    metadata.potentiallyClosesScope = true;
    await this._object.close(params);
  }

  async killForTests(_: any, metadata: CallMetadata): Promise<void> {
    if (this._options.ignoreStopAndKill)
      return;
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

  async cleanupContexts() {
    await Promise.all(Array.from(this._isolatedContexts).map(context => context.close({ reason: 'Global context cleanup (connection terminated)' })));
  }
}
