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
import type { DispatcherScope } from './dispatcher';
import { Dispatcher, lookupDispatcher } from './dispatcher';
import { PageDispatcher, BindingCallDispatcher, WorkerDispatcher } from './pageDispatcher';
import type { FrameDispatcher } from './frameDispatcher';
import type * as channels from '../../protocol/channels';
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
import { createGuid } from '../../utils';
import { WritableStreamDispatcher } from './writableStreamDispatcher';

export class BrowserContextDispatcher extends Dispatcher<BrowserContext, channels.BrowserContextChannel> implements channels.BrowserContextChannel {
  _type_EventTarget = true;
  _type_BrowserContext = true;
  private _context: BrowserContext;

  constructor(scope: DispatcherScope, context: BrowserContext) {
    super(scope, context, 'BrowserContext', {
      isChromium: context._browser.options.isChromium,
      APIRequestContext: APIRequestContextDispatcher.from(scope, context.fetchRequest),
      tracing: TracingDispatcher.from(scope, context.tracing),
    }, true);
    this._context = context;
    // Note: when launching persistent context, dispatcher is created very late,
    // so we can already have pages, videos and everything else.

    const onVideo = (artifact: Artifact) => {
      // Note: Video must outlive Page and BrowserContext, so that client can saveAs it
      // after closing the context. We use |scope| for it.
      const artifactDispatcher = new ArtifactDispatcher(scope, artifact);
      this._dispatchEvent('video', { artifact: artifactDispatcher });
    };
    context.on(BrowserContext.Events.VideoStarted, onVideo);
    for (const video of context._browser._idToVideo.values()) {
      if (video.context === context)
        onVideo(video.artifact);
    }

    for (const page of context.pages())
      this._dispatchEvent('page', { page: new PageDispatcher(this._scope, page) });
    context.on(BrowserContext.Events.Page, page => this._dispatchEvent('page', { page: new PageDispatcher(this._scope, page) }));
    context.on(BrowserContext.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });

    if (context._browser.options.name === 'chromium') {
      for (const page of (context as CRBrowserContext).backgroundPages())
        this._dispatchEvent('backgroundPage', { page: new PageDispatcher(this._scope, page) });
      context.on(CRBrowserContext.CREvents.BackgroundPage, page => this._dispatchEvent('backgroundPage', { page: new PageDispatcher(this._scope, page) }));
      for (const serviceWorker of (context as CRBrowserContext).serviceWorkers())
        this._dispatchEvent('serviceWorker', { worker: new WorkerDispatcher(this._scope, serviceWorker) });
      context.on(CRBrowserContext.CREvents.ServiceWorker, serviceWorker => this._dispatchEvent('serviceWorker', { worker: new WorkerDispatcher(this._scope, serviceWorker) }));
    }
    context.on(BrowserContext.Events.Request, (request: Request) =>  {
      return this._dispatchEvent('request', {
        request: RequestDispatcher.from(this._scope, request),
        page: PageDispatcher.fromNullable(this._scope, request.frame()._page.initializedOrUndefined())
      });
    });
    context.on(BrowserContext.Events.Response, (response: Response) => this._dispatchEvent('response', {
      response: ResponseDispatcher.from(this._scope, response),
      page: PageDispatcher.fromNullable(this._scope, response.frame()._page.initializedOrUndefined())
    }));
    context.on(BrowserContext.Events.RequestFailed, (request: Request) => this._dispatchEvent('requestFailed', {
      request: RequestDispatcher.from(this._scope, request),
      failureText: request._failureText || undefined,
      responseEndTiming: request._responseEndTiming,
      page: PageDispatcher.fromNullable(this._scope, request.frame()._page.initializedOrUndefined())
    }));
    context.on(BrowserContext.Events.RequestFinished, ({ request, response }: { request: Request, response: Response | null }) => this._dispatchEvent('requestFinished', {
      request: RequestDispatcher.from(scope, request),
      response: ResponseDispatcher.fromNullable(scope, response),
      responseEndTiming: request._responseEndTiming,
      page: PageDispatcher.fromNullable(this._scope, request.frame()._page.initializedOrUndefined()),
    }));
  }

  async createTempFile(params: channels.BrowserContextCreateTempFileParams, metadata?: channels.Metadata): Promise<channels.BrowserContextCreateTempFileResult> {
    const dir = this._context._browser.options.artifactsDir;
    const tmpDir = path.join(dir, 'upload-' + createGuid());
    await fs.promises.mkdir(tmpDir);
    this._context._tempDirs.push(tmpDir);
    const file = fs.createWriteStream(path.join(tmpDir, params.name));
    return { writableStream: new WritableStreamDispatcher(this._scope, file) };
  }

  async setDefaultNavigationTimeoutNoReply(params: channels.BrowserContextSetDefaultNavigationTimeoutNoReplyParams) {
    this._context.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: channels.BrowserContextSetDefaultTimeoutNoReplyParams) {
    this._context.setDefaultTimeout(params.timeout);
  }

  async exposeBinding(params: channels.BrowserContextExposeBindingParams): Promise<void> {
    await this._context.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      const binding = new BindingCallDispatcher(this._scope, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async removeExposedBindings() {
    await this._context.removeExposedBindings();
  }

  async newPage(params: channels.BrowserContextNewPageParams, metadata: CallMetadata): Promise<channels.BrowserContextNewPageResult> {
    return { page: lookupDispatcher<PageDispatcher>(await this._context.newPage(metadata)) };
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

  async removeInitScripts(): Promise<void> {
    await this._context.removeInitScripts();
  }

  async setNetworkInterceptionEnabled(params: channels.BrowserContextSetNetworkInterceptionEnabledParams): Promise<void> {
    if (!params.enabled) {
      await this._context.setRequestInterceptor(undefined);
      return;
    }
    await this._context.setRequestInterceptor((route, request) => {
      this._dispatchEvent('route', { route: RouteDispatcher.from(this._scope, route), request: RequestDispatcher.from(this._scope, request) });
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
    return { session: new CDPSessionDispatcher(this._scope, await crBrowserContext.newCDPSession((params.page ? params.page as PageDispatcher : params.frame as FrameDispatcher)._object)) };
  }

  async harExport(params: channels.BrowserContextHarExportParams): Promise<channels.BrowserContextHarExportResult> {
    const artifact = await this._context._harRecorder?.export();
    if (!artifact)
      throw new Error('No HAR artifact. Ensure record.harPath is set.');
    return { artifact: new ArtifactDispatcher(this._scope, artifact) };
  }
}
