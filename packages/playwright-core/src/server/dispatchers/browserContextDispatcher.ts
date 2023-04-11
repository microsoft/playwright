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

import { BrowserContext } from '../browserContext';
import { Dispatcher, existingDispatcher } from './dispatcher';
import type { DispatcherScope } from './dispatcher';
import { PageDispatcher, BindingCallDispatcher, WorkerDispatcher } from './pageDispatcher';
import type { FrameDispatcher } from './frameDispatcher';
import type * as channels from '@protocol/channels';
import { RouteDispatcher, RequestDispatcher, ResponseDispatcher, APIRequestContextDispatcher } from './networkDispatchers';
import { CRBrowserContext } from '../chromium/crBrowser';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { Recorder } from '../recorder';
import type { CallMetadata } from '../instrumentation';
import { ArtifactDispatcher } from './artifactDispatcher';
import type { Artifact } from '../artifact';
import type { Request, Response } from '../network';
import { TracingDispatcher } from './tracingDispatcher';
import * as fs from 'fs';
import * as path from 'path';
import { createGuid, urlMatches } from '../../utils';
import { WritableStreamDispatcher } from './writableStreamDispatcher';

export class BrowserContextDispatcher extends Dispatcher<BrowserContext, channels.BrowserContextChannel, DispatcherScope> implements channels.BrowserContextChannel {
  _type_EventTarget = true;
  _type_BrowserContext = true;
  private _context: BrowserContext;
  private _subscriptions = new Set<channels.BrowserContextUpdateSubscriptionParams['event']>();

  constructor(parentScope: DispatcherScope, context: BrowserContext) {
    // We will reparent these to the context below.
    const requestContext = APIRequestContextDispatcher.from(parentScope as BrowserContextDispatcher, context.fetchRequest);
    const tracing = TracingDispatcher.from(parentScope as BrowserContextDispatcher, context.tracing);

    super(parentScope, context, 'BrowserContext', {
      isChromium: context._browser.options.isChromium,
      requestContext,
      tracing,
    });

    this.adopt(requestContext);
    this.adopt(tracing);

    this._context = context;
    // Note: when launching persistent context, dispatcher is created very late,
    // so we can already have pages, videos and everything else.

    const onVideo = (artifact: Artifact) => {
      // Note: Video must outlive Page and BrowserContext, so that client can saveAs it
      // after closing the context. We use |scope| for it.
      const artifactDispatcher = ArtifactDispatcher.from(parentScope, artifact);
      this._dispatchEvent('video', { artifact: artifactDispatcher });
    };
    this.addObjectListener(BrowserContext.Events.VideoStarted, onVideo);
    for (const video of context._browser._idToVideo.values()) {
      if (video.context === context)
        onVideo(video.artifact);
    }

    for (const page of context.pages())
      this._dispatchEvent('page', { page: PageDispatcher.from(this, page) });
    this.addObjectListener(BrowserContext.Events.Page, page => {
      this._dispatchEvent('page', { page: PageDispatcher.from(this, page) });
    });
    this.addObjectListener(BrowserContext.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });

    if (context._browser.options.name === 'chromium') {
      for (const page of (context as CRBrowserContext).backgroundPages())
        this._dispatchEvent('backgroundPage', { page: PageDispatcher.from(this, page) });
      this.addObjectListener(CRBrowserContext.CREvents.BackgroundPage, page => this._dispatchEvent('backgroundPage', { page: PageDispatcher.from(this, page) }));
      for (const serviceWorker of (context as CRBrowserContext).serviceWorkers())
        this._dispatchEvent('serviceWorker', { worker: new WorkerDispatcher(this, serviceWorker) });
      this.addObjectListener(CRBrowserContext.CREvents.ServiceWorker, serviceWorker => this._dispatchEvent('serviceWorker', { worker: new WorkerDispatcher(this, serviceWorker) }));
    }
    this.addObjectListener(BrowserContext.Events.Request, (request: Request) =>  {
      // Create dispatcher, if:
      // - There are listeners to the requests.
      // - We are redirected from a reported request so that redirectedTo was updated on client.
      // - We are a navigation request and dispatcher will be reported as a part of the goto return value and newDocument param anyways.
      //   By the time requestFinished is triggered to update the request, we should have a request on the client already.
      const redirectFromDispatcher = request.redirectedFrom() && existingDispatcher(request.redirectedFrom());
      if (!redirectFromDispatcher && !this._shouldDispatchNetworkEvent(request, 'request') && !request.isNavigationRequest())
        return;
      const requestDispatcher = RequestDispatcher.from(this, request);
      this._dispatchEvent('request', {
        request: requestDispatcher,
        page: PageDispatcher.fromNullable(this, request.frame()?._page.initializedOrUndefined())
      });
    });
    this.addObjectListener(BrowserContext.Events.Response, (response: Response) => {
      const requestDispatcher = existingDispatcher<RequestDispatcher>(response.request());
      if (!requestDispatcher && !this._shouldDispatchNetworkEvent(response.request(), 'response'))
        return;
      this._dispatchEvent('response', {
        response: ResponseDispatcher.from(this, response),
        page: PageDispatcher.fromNullable(this, response.frame()?._page.initializedOrUndefined())
      });
    });
    this.addObjectListener(BrowserContext.Events.RequestFailed, (request: Request) => {
      const requestDispatcher = existingDispatcher<RequestDispatcher>(request);
      if (!requestDispatcher && !this._shouldDispatchNetworkEvent(request, 'requestFailed'))
        return;
      this._dispatchEvent('requestFailed', {
        request: RequestDispatcher.from(this, request),
        failureText: request._failureText || undefined,
        responseEndTiming: request._responseEndTiming,
        page: PageDispatcher.fromNullable(this, request.frame()?._page.initializedOrUndefined())
      });
    });
    this.addObjectListener(BrowserContext.Events.RequestFinished, ({ request, response }: { request: Request, response: Response | null }) => {
      const requestDispatcher = existingDispatcher<RequestDispatcher>(request);
      if (!requestDispatcher && !this._shouldDispatchNetworkEvent(request, 'requestFinished'))
        return;
      this._dispatchEvent('requestFinished', {
        request: RequestDispatcher.from(this, request),
        response: ResponseDispatcher.fromNullable(this, response),
        responseEndTiming: request._responseEndTiming,
        page: PageDispatcher.fromNullable(this, request.frame()?._page.initializedOrUndefined()),
      });
    });
  }

  private _shouldDispatchNetworkEvent(request: Request, event: channels.BrowserContextUpdateSubscriptionParams['event'] & channels.PageUpdateSubscriptionParams['event']): boolean {
    if (this._subscriptions.has(event))
      return true;
    const page = request.frame()?._page?.initializedOrUndefined();
    const pageDispatcher = page ? existingDispatcher<PageDispatcher>(page) : undefined;
    if (pageDispatcher?._subscriptions.has(event))
      return true;
    return false;
  }

  async createTempFile(params: channels.BrowserContextCreateTempFileParams): Promise<channels.BrowserContextCreateTempFileResult> {
    const dir = this._context._browser.options.artifactsDir;
    const tmpDir = path.join(dir, 'upload-' + createGuid());
    await fs.promises.mkdir(tmpDir);
    this._context._tempDirs.push(tmpDir);
    const file = fs.createWriteStream(path.join(tmpDir, params.name));
    return { writableStream: new WritableStreamDispatcher(this, file) };
  }

  async setDefaultNavigationTimeoutNoReply(params: channels.BrowserContextSetDefaultNavigationTimeoutNoReplyParams) {
    this._context.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: channels.BrowserContextSetDefaultTimeoutNoReplyParams) {
    this._context.setDefaultTimeout(params.timeout);
  }

  async exposeBinding(params: channels.BrowserContextExposeBindingParams): Promise<void> {
    await this._context.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      const pageDispatcher = PageDispatcher.from(this, source.page);
      const binding = new BindingCallDispatcher(pageDispatcher, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async newPage(params: channels.BrowserContextNewPageParams, metadata: CallMetadata): Promise<channels.BrowserContextNewPageResult> {
    return { page: PageDispatcher.from(this, await this._context.newPage(metadata)) };
  }

  async cookies(params: channels.BrowserContextCookiesParams): Promise<channels.BrowserContextCookiesResult> {
    return { cookies: await this._context.cookies(params.urls) };
  }

  async addCookies(params: channels.BrowserContextAddCookiesParams): Promise<void> {
    await this._context.addCookies(params.cookies);
  }

  async clearCookies(): Promise<void> {
    await this._context.clearCookies();
  }

  async grantPermissions(params: channels.BrowserContextGrantPermissionsParams): Promise<void> {
    await this._context.grantPermissions(params.permissions, params.origin);
  }

  async clearPermissions(): Promise<void> {
    await this._context.clearPermissions();
  }

  async setGeolocation(params: channels.BrowserContextSetGeolocationParams): Promise<void> {
    await this._context.setGeolocation(params.geolocation);
  }

  async setExtraHTTPHeaders(params: channels.BrowserContextSetExtraHTTPHeadersParams): Promise<void> {
    await this._context.setExtraHTTPHeaders(params.headers);
  }

  async setOffline(params: channels.BrowserContextSetOfflineParams): Promise<void> {
    await this._context.setOffline(params.offline);
  }

  async setHTTPCredentials(params: channels.BrowserContextSetHTTPCredentialsParams): Promise<void> {
    await this._context.setHTTPCredentials(params.httpCredentials);
  }

  async addInitScript(params: channels.BrowserContextAddInitScriptParams): Promise<void> {
    await this._context.addInitScript(params.source);
  }

  async setNetworkInterceptionPatterns(params: channels.BrowserContextSetNetworkInterceptionPatternsParams): Promise<void> {
    if (!params.patterns.length) {
      await this._context.setRequestInterceptor(undefined);
      return;
    }
    const urlMatchers = params.patterns.map(pattern => pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags!) : pattern.glob!);
    await this._context.setRequestInterceptor((route, request) => {
      const matchesSome = urlMatchers.some(urlMatch => urlMatches(this._context._options.baseURL, request.url(), urlMatch));
      if (!matchesSome)
        return false;
      this._dispatchEvent('route', { route: RouteDispatcher.from(RequestDispatcher.from(this, request), route) });
      return true;
    });
  }

  async storageState(params: channels.BrowserContextStorageStateParams, metadata: CallMetadata): Promise<channels.BrowserContextStorageStateResult> {
    return await this._context.storageState();
  }

  async close(params: channels.BrowserContextCloseParams, metadata: CallMetadata): Promise<void> {
    await this._context.close(metadata);
  }

  async recorderSupplementEnable(params: channels.BrowserContextRecorderSupplementEnableParams): Promise<void> {
    await Recorder.show(this._context, params);
  }

  async pause(params: channels.BrowserContextPauseParams, metadata: CallMetadata) {
    // Debugger will take care of this.
  }

  async newCDPSession(params: channels.BrowserContextNewCDPSessionParams): Promise<channels.BrowserContextNewCDPSessionResult> {
    if (!this._object._browser.options.isChromium)
      throw new Error(`CDP session is only available in Chromium`);
    if (!params.page && !params.frame || params.page && params.frame)
      throw new Error(`CDP session must be initiated with either Page or Frame, not none or both`);
    const crBrowserContext = this._object as CRBrowserContext;
    return { session: new CDPSessionDispatcher(this, await crBrowserContext.newCDPSession((params.page ? params.page as PageDispatcher : params.frame as FrameDispatcher)._object)) };
  }

  async harStart(params: channels.BrowserContextHarStartParams): Promise<channels.BrowserContextHarStartResult> {
    const harId = await this._context._harStart(params.page ? (params.page as PageDispatcher)._object : null, params.options);
    return { harId };
  }

  async harExport(params: channels.BrowserContextHarExportParams): Promise<channels.BrowserContextHarExportResult> {
    const artifact = await this._context._harExport(params.harId);
    if (!artifact)
      throw new Error('No HAR artifact. Ensure record.harPath is set.');
    return { artifact: ArtifactDispatcher.from(this, artifact) };
  }

  async updateSubscription(params: channels.BrowserContextUpdateSubscriptionParams): Promise<void> {
    if (params.enabled)
      this._subscriptions.add(params.event);
    else
      this._subscriptions.delete(params.event);
  }

  override _onDispose() {
    // Avoid protocol calls for the closed context.
    if (!this._context.isClosingOrClosed())
      this._context.setRequestInterceptor(undefined).catch(() => {});
  }
}
