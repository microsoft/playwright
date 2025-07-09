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

import fs from 'fs';
import path from 'path';

import { BrowserContext } from '../browserContext';
import { ArtifactDispatcher } from './artifactDispatcher';
import { CDPSessionDispatcher } from './cdpSessionDispatcher';
import { DialogDispatcher } from './dialogDispatcher';
import { Dispatcher } from './dispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { JSHandleDispatcher } from './jsHandleDispatcher';
import { APIRequestContextDispatcher, RequestDispatcher, ResponseDispatcher, RouteDispatcher } from './networkDispatchers';
import { BindingCallDispatcher, PageDispatcher, WorkerDispatcher } from './pageDispatcher';
import { CRBrowserContext } from '../chromium/crBrowser';
import { serializeError } from '../errors';
import { TracingDispatcher } from './tracingDispatcher';
import { WebSocketRouteDispatcher } from './webSocketRouteDispatcher';
import { WritableStreamDispatcher } from './writableStreamDispatcher';
import { createGuid } from '../utils/crypto';
import { urlMatches } from '../../utils/isomorphic/urlMatch';
import { Recorder } from '../recorder';
import { ProgrammaticRecorderApp, RecorderApp } from '../recorder/recorderApp';

import type { Artifact } from '../artifact';
import type { ConsoleMessage } from '../console';
import type { Dialog } from '../dialog';
import type { Request, Response, RouteHandler } from '../network';
import type { InitScript, Page, PageBinding } from '../page';
import type { DispatcherScope } from './dispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class BrowserContextDispatcher extends Dispatcher<BrowserContext, channels.BrowserContextChannel, DispatcherScope> implements channels.BrowserContextChannel {
  _type_EventTarget = true;
  _type_BrowserContext = true;
  private _context: BrowserContext;
  private _subscriptions = new Set<channels.BrowserContextUpdateSubscriptionParams['event']>();
  _webSocketInterceptionPatterns: channels.BrowserContextSetWebSocketInterceptionPatternsParams['patterns'] = [];
  private _bindings: PageBinding[] = [];
  private _initScripts: InitScript[] = [];
  private _dialogHandler: (dialog: Dialog) => boolean;
  private _clockPaused = false;
  private _requestInterceptor: RouteHandler;
  private _interceptionUrlMatchers: (string | RegExp)[] = [];
  private _routeWebSocketInitScript: InitScript | undefined;

  static from(parentScope: DispatcherScope, context: BrowserContext): BrowserContextDispatcher {
    const result = parentScope.connection.existingDispatcher<BrowserContextDispatcher>(context);
    return result || new BrowserContextDispatcher(parentScope, context);
  }

  private constructor(parentScope: DispatcherScope, context: BrowserContext) {
    // We will reparent these to the context below.
    const requestContext = APIRequestContextDispatcher.from(parentScope as BrowserContextDispatcher, context.fetchRequest);
    const tracing = TracingDispatcher.from(parentScope as BrowserContextDispatcher, context.tracing);

    super(parentScope, context, 'BrowserContext', {
      isChromium: context._browser.options.isChromium,
      requestContext,
      tracing,
      options: context._options,
    });

    this.adopt(requestContext);
    this.adopt(tracing);

    this._requestInterceptor = (route, request) => {
      const matchesSome = this._interceptionUrlMatchers.some(urlMatch => urlMatches(this._context._options.baseURL, request.url(), urlMatch));
      // If there is already a dispatcher, that means we've already routed this request through page.
      // Client expects a single `route` event, either on the page or on the context, so we can just fallback here.
      const routeDispatcher = this.connection.existingDispatcher<RouteDispatcher>(route);
      if (!matchesSome || routeDispatcher) {
        route.continue({ isFallback: true }).catch(() => {});
        return;
      }
      this._dispatchEvent('route', { route: new RouteDispatcher(RequestDispatcher.from(this, request), route) });
    };

    this._context = context;
    // Note: when launching persistent context, or connecting to an existing browser,
    // dispatcher is created very late, so we can already have pages, videos and everything else.

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
    this.addObjectListener(BrowserContext.Events.PageError, (error: Error, page: Page) => {
      this._dispatchEvent('pageError', { error: serializeError(error), page: PageDispatcher.from(this, page) });
    });
    this.addObjectListener(BrowserContext.Events.Console, (message: ConsoleMessage) => {
      const page = message.page()!;
      if (this._shouldDispatchEvent(page, 'console')) {
        const pageDispatcher = PageDispatcher.from(this, page);
        this._dispatchEvent('console', {
          page: pageDispatcher,
          type: message.type(),
          text: message.text(),
          args: message.args().map(a => {
            const elementHandle = a.asElement();
            if (elementHandle)
              return ElementHandleDispatcher.from(FrameDispatcher.from(this, elementHandle._frame), elementHandle);
            return JSHandleDispatcher.fromJSHandle(pageDispatcher, a);
          }),
          location: message.location(),
        });
      }
    });
    this._dialogHandler = dialog => {
      if (!this._shouldDispatchEvent(dialog.page(), 'dialog'))
        return false;
      this._dispatchEvent('dialog', { dialog: new DialogDispatcher(this, dialog) });
      return true;
    };
    context.dialogManager.addDialogHandler(this._dialogHandler);

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
      const redirectFromDispatcher = request.redirectedFrom() && this.connection.existingDispatcher(request.redirectedFrom());
      if (!redirectFromDispatcher && !this._shouldDispatchNetworkEvent(request, 'request') && !request.isNavigationRequest())
        return;
      const requestDispatcher = RequestDispatcher.from(this, request);
      this._dispatchEvent('request', {
        request: requestDispatcher,
        page: PageDispatcher.fromNullable(this, request.frame()?._page.initializedOrUndefined())
      });
    });
    this.addObjectListener(BrowserContext.Events.Response, (response: Response) => {
      const requestDispatcher = this.connection.existingDispatcher<RequestDispatcher>(response.request());
      if (!requestDispatcher && !this._shouldDispatchNetworkEvent(response.request(), 'response'))
        return;
      this._dispatchEvent('response', {
        response: ResponseDispatcher.from(this, response),
        page: PageDispatcher.fromNullable(this, response.frame()?._page.initializedOrUndefined())
      });
    });
    this.addObjectListener(BrowserContext.Events.RequestFailed, (request: Request) => {
      const requestDispatcher = this.connection.existingDispatcher<RequestDispatcher>(request);
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
      const requestDispatcher = this.connection.existingDispatcher<RequestDispatcher>(request);
      if (!requestDispatcher && !this._shouldDispatchNetworkEvent(request, 'requestFinished'))
        return;
      this._dispatchEvent('requestFinished', {
        request: RequestDispatcher.from(this, request),
        response: ResponseDispatcher.fromNullable(this, response),
        responseEndTiming: request._responseEndTiming,
        page: PageDispatcher.fromNullable(this, request.frame()?._page.initializedOrUndefined()),
      });
    });
    this.addObjectListener(BrowserContext.Events.RecorderEvent, ({ event, data, page }: { event: 'actionAdded' | 'actionUpdated' | 'signalAdded', data: any, page: Page }) => {
      this._dispatchEvent('recorderEvent', { event, data, page: PageDispatcher.from(this, page) });
    });
  }

  private _shouldDispatchNetworkEvent(request: Request, event: channels.BrowserContextUpdateSubscriptionParams['event'] & channels.PageUpdateSubscriptionParams['event']): boolean {
    return this._shouldDispatchEvent(request.frame()?._page?.initializedOrUndefined(), event);
  }

  private _shouldDispatchEvent(page: Page | undefined, event: channels.BrowserContextUpdateSubscriptionParams['event'] & channels.PageUpdateSubscriptionParams['event']): boolean {
    if (this._subscriptions.has(event))
      return true;
    const pageDispatcher = page ? this.connection.existingDispatcher<PageDispatcher>(page) : undefined;
    if (pageDispatcher?._subscriptions.has(event))
      return true;
    return false;
  }

  async createTempFiles(params: channels.BrowserContextCreateTempFilesParams, progress: Progress): Promise<channels.BrowserContextCreateTempFilesResult> {
    const dir = this._context._browser.options.artifactsDir;
    const tmpDir = path.join(dir, 'upload-' + createGuid());
    const tempDirWithRootName = params.rootDirName ? path.join(tmpDir, path.basename(params.rootDirName)) : tmpDir;
    await progress.race(fs.promises.mkdir(tempDirWithRootName, { recursive: true }));
    this._context._tempDirs.push(tmpDir);
    return {
      rootDir: params.rootDirName ? new WritableStreamDispatcher(this, tempDirWithRootName) : undefined,
      writableStreams: await Promise.all(params.items.map(async item => {
        await progress.race(fs.promises.mkdir(path.dirname(path.join(tempDirWithRootName, item.name)), { recursive: true }));
        const file = fs.createWriteStream(path.join(tempDirWithRootName, item.name));
        return new WritableStreamDispatcher(this, file, item.lastModifiedMs);
      }))
    };
  }

  async exposeBinding(params: channels.BrowserContextExposeBindingParams, progress: Progress): Promise<void> {
    const binding = await this._context.exposeBinding(progress, params.name, !!params.needsHandle, (source, ...args) => {
      // When reusing the context, we might have some bindings called late enough,
      // after context and page dispatchers have been disposed.
      if (this._disposed)
        return;
      const pageDispatcher = PageDispatcher.from(this, source.page);
      const binding = new BindingCallDispatcher(pageDispatcher, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
    this._bindings.push(binding);
  }

  async newPage(params: channels.BrowserContextNewPageParams, progress: Progress): Promise<channels.BrowserContextNewPageResult> {
    return { page: PageDispatcher.from(this, await this._context.newPage(progress, false /* isServerSide */)) };
  }

  async cookies(params: channels.BrowserContextCookiesParams, progress: Progress): Promise<channels.BrowserContextCookiesResult> {
    return { cookies: await progress.race(this._context.cookies(params.urls)) };
  }

  async addCookies(params: channels.BrowserContextAddCookiesParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    await this._context.addCookies(params.cookies);
  }

  async clearCookies(params: channels.BrowserContextClearCookiesParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    const nameRe = params.nameRegexSource !== undefined && params.nameRegexFlags !== undefined ? new RegExp(params.nameRegexSource, params.nameRegexFlags) : undefined;
    const domainRe = params.domainRegexSource !== undefined && params.domainRegexFlags !== undefined ? new RegExp(params.domainRegexSource, params.domainRegexFlags) : undefined;
    const pathRe = params.pathRegexSource !== undefined && params.pathRegexFlags !== undefined ? new RegExp(params.pathRegexSource, params.pathRegexFlags) : undefined;
    await this._context.clearCookies({
      name: nameRe || params.name,
      domain: domainRe || params.domain,
      path: pathRe || params.path,
    });
  }

  async grantPermissions(params: channels.BrowserContextGrantPermissionsParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    await this._context.grantPermissions(params.permissions, params.origin);
  }

  async clearPermissions(params: channels.BrowserContextClearPermissionsParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    await this._context.clearPermissions();
  }

  async setGeolocation(params: channels.BrowserContextSetGeolocationParams, progress: Progress): Promise<void> {
    // Note: progress is ignored because this operation is not cancellable and should not block in the browser anyway.
    await this._context.setGeolocation(params.geolocation);
  }

  async setExtraHTTPHeaders(params: channels.BrowserContextSetExtraHTTPHeadersParams, progress: Progress): Promise<void> {
    await this._context.setExtraHTTPHeaders(progress, params.headers);
  }

  async setOffline(params: channels.BrowserContextSetOfflineParams, progress: Progress): Promise<void> {
    await this._context.setOffline(progress, params.offline);
  }

  async setHTTPCredentials(params: channels.BrowserContextSetHTTPCredentialsParams, progress: Progress): Promise<void> {
    // Note: this operation is deprecated, so we do not properly cleanup.
    await progress.race(this._context.setHTTPCredentials(params.httpCredentials));
  }

  async addInitScript(params: channels.BrowserContextAddInitScriptParams, progress: Progress): Promise<void> {
    this._initScripts.push(await this._context.addInitScript(progress, params.source));
  }

  async setNetworkInterceptionPatterns(params: channels.BrowserContextSetNetworkInterceptionPatternsParams, progress: Progress): Promise<void> {
    const hadMatchers = this._interceptionUrlMatchers.length > 0;
    if (!params.patterns.length) {
      // Note: it is important to remove the interceptor when there are no patterns,
      // because that disables the slow-path interception in the browser itself.
      if (hadMatchers)
        await this._context.removeRequestInterceptor(this._requestInterceptor);
      this._interceptionUrlMatchers = [];
    } else {
      this._interceptionUrlMatchers = params.patterns.map(pattern => pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags!) : pattern.glob!);
      if (!hadMatchers)
        await this._context.addRequestInterceptor(progress, this._requestInterceptor);
    }
  }

  async setWebSocketInterceptionPatterns(params: channels.PageSetWebSocketInterceptionPatternsParams, progress: Progress): Promise<void> {
    this._webSocketInterceptionPatterns = params.patterns;
    if (params.patterns.length && !this._routeWebSocketInitScript)
      this._routeWebSocketInitScript = await WebSocketRouteDispatcher.install(progress, this.connection, this._context);
  }

  async storageState(params: channels.BrowserContextStorageStateParams, progress: Progress): Promise<channels.BrowserContextStorageStateResult> {
    return await progress.race(this._context.storageState(progress, params.indexedDB));
  }

  async close(params: channels.BrowserContextCloseParams, progress: Progress): Promise<void> {
    progress.metadata.potentiallyClosesScope = true;
    await this._context.close(params);
  }

  async enableRecorder(params: channels.BrowserContextEnableRecorderParams, progress: Progress): Promise<void> {
    const recorder = await Recorder.forContext(this._context, params);
    if (params.recorderMode === 'api') {
      await ProgrammaticRecorderApp.run(this._context, recorder);
      return;
    }
    await RecorderApp.show(this._context, params);
  }

  async disableRecorder(params: channels.BrowserContextDisableRecorderParams, progress: Progress): Promise<void> {
    const recorder = Recorder.existingForContext(this._context);
    if (recorder)
      recorder.setMode('none');
  }

  async pause(params: channels.BrowserContextPauseParams, progress: Progress) {
    // Debugger will take care of this.
  }

  async newCDPSession(params: channels.BrowserContextNewCDPSessionParams, progress: Progress): Promise<channels.BrowserContextNewCDPSessionResult> {
    if (!this._object._browser.options.isChromium)
      throw new Error(`CDP session is only available in Chromium`);
    if (!params.page && !params.frame || params.page && params.frame)
      throw new Error(`CDP session must be initiated with either Page or Frame, not none or both`);
    const crBrowserContext = this._object as CRBrowserContext;
    return { session: new CDPSessionDispatcher(this, await progress.race(crBrowserContext.newCDPSession((params.page ? params.page as PageDispatcher : params.frame as FrameDispatcher)._object))) };
  }

  async harStart(params: channels.BrowserContextHarStartParams, progress: Progress): Promise<channels.BrowserContextHarStartResult> {
    const harId = this._context.harStart(params.page ? (params.page as PageDispatcher)._object : null, params.options);
    return { harId };
  }

  async harExport(params: channels.BrowserContextHarExportParams, progress: Progress): Promise<channels.BrowserContextHarExportResult> {
    const artifact = await progress.race(this._context.harExport(params.harId));
    if (!artifact)
      throw new Error('No HAR artifact. Ensure record.harPath is set.');
    return { artifact: ArtifactDispatcher.from(this, artifact) };
  }

  async clockFastForward(params: channels.BrowserContextClockFastForwardParams, progress: Progress): Promise<channels.BrowserContextClockFastForwardResult> {
    await this._context.clock.fastForward(progress, params.ticksString ?? params.ticksNumber ?? 0);
  }

  async clockInstall(params: channels.BrowserContextClockInstallParams, progress: Progress): Promise<channels.BrowserContextClockInstallResult> {
    await this._context.clock.install(progress, params.timeString ?? params.timeNumber ?? undefined);
  }

  async clockPauseAt(params: channels.BrowserContextClockPauseAtParams, progress: Progress): Promise<channels.BrowserContextClockPauseAtResult> {
    await this._context.clock.pauseAt(progress, params.timeString ?? params.timeNumber ?? 0);
    this._clockPaused = true;
  }

  async clockResume(params: channels.BrowserContextClockResumeParams, progress: Progress): Promise<channels.BrowserContextClockResumeResult> {
    await this._context.clock.resume(progress);
    this._clockPaused = false;
  }

  async clockRunFor(params: channels.BrowserContextClockRunForParams, progress: Progress): Promise<channels.BrowserContextClockRunForResult> {
    await this._context.clock.runFor(progress, params.ticksString ?? params.ticksNumber ?? 0);
  }

  async clockSetFixedTime(params: channels.BrowserContextClockSetFixedTimeParams, progress: Progress): Promise<channels.BrowserContextClockSetFixedTimeResult> {
    await this._context.clock.setFixedTime(progress, params.timeString ?? params.timeNumber ?? 0);
  }

  async clockSetSystemTime(params: channels.BrowserContextClockSetSystemTimeParams, progress: Progress): Promise<channels.BrowserContextClockSetSystemTimeResult> {
    await this._context.clock.setSystemTime(progress, params.timeString ?? params.timeNumber ?? 0);
  }

  async updateSubscription(params: channels.BrowserContextUpdateSubscriptionParams, progress: Progress): Promise<void> {
    if (params.enabled)
      this._subscriptions.add(params.event);
    else
      this._subscriptions.delete(params.event);
  }

  async registerSelectorEngine(params: channels.BrowserContextRegisterSelectorEngineParams, progress: Progress): Promise<void> {
    this._object.selectors().register(params.selectorEngine);
  }

  async setTestIdAttributeName(params: channels.BrowserContextSetTestIdAttributeNameParams, progress: Progress): Promise<void> {
    this._object.selectors().setTestIdAttributeName(params.testIdAttributeName);
  }

  override _onDispose() {
    // Avoid protocol calls for the closed context.
    if (this._context.isClosingOrClosed())
      return;

    // Cleanup properly and leave the page in a good state. Other clients may still connect and use it.
    this._context.dialogManager.removeDialogHandler(this._dialogHandler);
    this._interceptionUrlMatchers = [];
    this._context.removeRequestInterceptor(this._requestInterceptor).catch(() => {});
    this._context.removeExposedBindings(this._bindings).catch(() => {});
    this._bindings = [];
    this._context.removeInitScripts(this._initScripts).catch(() => {});
    this._initScripts = [];
    if (this._routeWebSocketInitScript)
      WebSocketRouteDispatcher.uninstall(this.connection, this._context, this._routeWebSocketInitScript).catch(() => {});
    this._routeWebSocketInitScript = undefined;
    if (this._clockPaused)
      this._context.clock.resumeNoReply();
    this._clockPaused = false;
  }
}
