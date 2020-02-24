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

import * as types from './types';
import * as js from './javascript';
import * as dom from './dom';
import * as network from './network';
import { helper, assert, RegisteredListener } from './helper';
import { TimeoutError } from './errors';
import { Events } from './events';
import { Page } from './page';
import { ConsoleMessage } from './console';
import * as platform from './platform';

type ContextType = 'main' | 'utility';
type ContextData = {
  contextPromise: Promise<dom.FrameExecutionContext>;
  contextResolveCallback: (c: dom.FrameExecutionContext) => void;
  context: dom.FrameExecutionContext | null;
  rerunnableTasks: Set<RerunnableTask>;
};

export type NavigateOptions = {
  timeout?: number,
  waitUntil?: LifecycleEvent | LifecycleEvent[],
};

export type WaitForNavigationOptions = NavigateOptions & { url?: types.URLMatch };

export type GotoOptions = NavigateOptions & {
  referer?: string,
};
export type GotoResult = {
  newDocumentId?: string,
};

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']);

type ConsoleTagHandler = () => void;

export class FrameManager {
  private _page: Page;
  private _frames = new Map<string, Frame>();
  private _mainFrame: Frame;
  readonly _lifecycleWatchers = new Set<() => void>();
  readonly _consoleMessageTags = new Map<string, ConsoleTagHandler>();

  constructor(page: Page) {
    this._page = page;
    this._mainFrame = undefined as any as Frame;
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frames() {
    const frames: Frame[] = [];
    collect(this._mainFrame);
    return frames;

    function collect(frame: Frame) {
      frames.push(frame);
      for (const subframe of frame.childFrames())
        collect(subframe);
    }
  }

  frame(frameId: string): Frame | null {
    return this._frames.get(frameId) || null;
  }

  frameAttached(frameId: string, parentFrameId: string | null | undefined): Frame {
    const parentFrame = parentFrameId ? this._frames.get(parentFrameId)! : null;
    if (!parentFrame) {
      if (this._mainFrame) {
        // Update frame id to retain frame identity on cross-process navigation.
        this._frames.delete(this._mainFrame._id);
        this._mainFrame._id = frameId;
      } else {
        assert(!this._frames.has(frameId));
        this._mainFrame = new Frame(this._page, frameId, parentFrame);
      }
      this._frames.set(frameId, this._mainFrame);
      return this._mainFrame;
    } else {
      assert(!this._frames.has(frameId));
      const frame = new Frame(this._page, frameId, parentFrame);
      this._frames.set(frameId, frame);
      this._page.emit(Events.Page.FrameAttached, frame);
      return frame;
    }
  }

  frameCommittedNewDocumentNavigation(frameId: string, url: string, name: string, documentId: string, initial: boolean) {
    const frame = this._frames.get(frameId)!;
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._url = url;
    frame._name = name;
    frame._lastDocumentId = documentId;
    for (const watcher of frame._documentWatchers)
      watcher(documentId);
    this.clearFrameLifecycle(frame);
    if (!initial)
      this._page.emit(Events.Page.FrameNavigated, frame);
  }

  frameCommittedSameDocumentNavigation(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._url = url;
    for (const watcher of frame._sameDocumentNavigationWatchers)
      watcher();
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  frameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  frameStoppedLoading(frameId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    const hasDOMContentLoaded = frame._firedLifecycleEvents.has('domcontentloaded');
    const hasLoad = frame._firedLifecycleEvents.has('load');
    frame._firedLifecycleEvents.add('domcontentloaded');
    frame._firedLifecycleEvents.add('load');
    for (const watcher of this._lifecycleWatchers)
      watcher();
    if (frame === this.mainFrame() && !hasDOMContentLoaded)
      this._page.emit(Events.Page.DOMContentLoaded);
    if (frame === this.mainFrame() && !hasLoad)
      this._page.emit(Events.Page.Load);
  }

  frameLifecycleEvent(frameId: string, event: LifecycleEvent) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._firedLifecycleEvents.add(event);
    for (const watcher of this._lifecycleWatchers)
      watcher();
    if (frame === this._mainFrame && event === 'load')
      this._page.emit(Events.Page.Load);
    if (frame === this._mainFrame && event === 'domcontentloaded')
      this._page.emit(Events.Page.DOMContentLoaded);
  }

  clearFrameLifecycle(frame: Frame) {
    frame._firedLifecycleEvents.clear();
    // Keep the current navigation request if any.
    frame._inflightRequests = new Set(Array.from(frame._inflightRequests).filter(request => request._documentId === frame._lastDocumentId));
    this._stopNetworkIdleTimer(frame, 'networkidle0');
    if (frame._inflightRequests.size === 0)
      this._startNetworkIdleTimer(frame, 'networkidle0');
    this._stopNetworkIdleTimer(frame, 'networkidle2');
    if (frame._inflightRequests.size <= 2)
      this._startNetworkIdleTimer(frame, 'networkidle2');
  }

  requestStarted(request: network.Request) {
    this._inflightRequestStarted(request);
    const frame = request.frame();
    if (frame) {
      for (const watcher of frame._requestWatchers)
        watcher(request);
    }
    if (!request._isFavicon)
      this._page._requestStarted(request);
  }

  requestReceivedResponse(response: network.Response) {
    if (!response.request()._isFavicon)
      this._page.emit(Events.Page.Response, response);
  }

  requestFinished(request: network.Request) {
    this._inflightRequestFinished(request);
    if (!request._isFavicon)
      this._page.emit(Events.Page.RequestFinished, request);
  }

  requestFailed(request: network.Request, canceled: boolean) {
    this._inflightRequestFinished(request);
    const frame = request.frame();
    if (request._documentId && frame) {
      const isCurrentDocument = frame._lastDocumentId === request._documentId;
      if (!isCurrentDocument) {
        let errorText = request.failure()!.errorText;
        if (canceled)
          errorText += '; maybe frame was detached?';
        for (const watcher of frame._documentWatchers)
          watcher(request._documentId, new Error(errorText));
      }
    }
    if (!request._isFavicon)
      this._page.emit(Events.Page.RequestFailed, request);
  }

  provisionalLoadFailed(frame: Frame, documentId: string, error: string) {
    for (const watcher of frame._documentWatchers)
      watcher(documentId, new Error(error));
  }

  private _removeFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._onDetached();
    this._frames.delete(frame._id);
    this._page.emit(Events.Page.FrameDetached, frame);
  }

  private _inflightRequestFinished(request: network.Request) {
    const frame = request.frame();
    if (!frame || request._isFavicon)
      return;
    if (!frame._inflightRequests.has(request))
      return;
    frame._inflightRequests.delete(request);
    if (frame._inflightRequests.size === 0)
      this._startNetworkIdleTimer(frame, 'networkidle0');
    if (frame._inflightRequests.size === 2)
      this._startNetworkIdleTimer(frame, 'networkidle2');
  }

  private _inflightRequestStarted(request: network.Request) {
    const frame = request.frame();
    if (!frame || request._isFavicon)
      return;
    frame._inflightRequests.add(request);
    if (frame._inflightRequests.size === 1)
      this._stopNetworkIdleTimer(frame, 'networkidle0');
    if (frame._inflightRequests.size === 3)
      this._stopNetworkIdleTimer(frame, 'networkidle2');
  }

  private _startNetworkIdleTimer(frame: Frame, event: LifecycleEvent) {
    assert(!frame._networkIdleTimers.has(event));
    if (frame._firedLifecycleEvents.has(event))
      return;
    frame._networkIdleTimers.set(event, setTimeout(() => {
      this.frameLifecycleEvent(frame._id, event);
    }, 500));
  }

  private _stopNetworkIdleTimer(frame: Frame, event: LifecycleEvent) {
    const timeoutId = frame._networkIdleTimers.get(event);
    if (timeoutId)
      clearTimeout(timeoutId);
    frame._networkIdleTimers.delete(event);
  }

  interceptConsoleMessage(message: ConsoleMessage): boolean {
    if (message.type() !== 'debug')
      return false;
    const tag = message.text();
    const handler = this._consoleMessageTags.get(tag);
    if (!handler)
      return false;
    this._consoleMessageTags.delete(tag);
    handler();
    return true;
  }
}

export class Frame {
  _id: string;
  readonly _firedLifecycleEvents: Set<LifecycleEvent>;
  _lastDocumentId = '';
  _requestWatchers = new Set<(request: network.Request) => void>();
  _documentWatchers = new Set<(documentId: string, error?: Error) => void>();
  _sameDocumentNavigationWatchers = new Set<() => void>();
  readonly _page: Page;
  private _parentFrame: Frame | null;
  _url = '';
  private _detached = false;
  private _contextData = new Map<ContextType, ContextData>();
  private _childFrames = new Set<Frame>();
  _name = '';
  _inflightRequests = new Set<network.Request>();
  readonly _networkIdleTimers = new Map<LifecycleEvent, NodeJS.Timer>();
  private _setContentCounter = 0;
  private _detachedPromise: Promise<void>;
  private _detachedCallback = () => {};

  constructor(page: Page, id: string, parentFrame: Frame | null) {
    this._id = id;
    this._firedLifecycleEvents = new Set();
    this._page = page;
    this._parentFrame = parentFrame;

    this._detachedPromise = new Promise<void>(x => this._detachedCallback = x);

    this._contextData.set('main', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._contextData.set('utility', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._setContext('main', null);
    this._setContext('utility', null);

    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  async goto(url: string, options: GotoOptions = {}): Promise<network.Response | null> {
    const headers = (this._page._state.extraHTTPHeaders || {});
    let referer = headers['referer'] || headers['Referer'];
    if (options.referer !== undefined) {
      if (referer !== undefined && referer !== options.referer)
        throw new Error('"referer" is already specified as extra HTTP header');
      referer = options.referer;
    }
    url = helper.completeUserURL(url);
    const { timeout = this._page._timeoutSettings.navigationTimeout() } = options;
    const disposer = new Disposer();

    const timeoutPromise = disposer.add(createTimeoutPromise(timeout));
    const frameDestroyedPromise = this._createFrameDestroyedPromise();
    const sameDocumentPromise = disposer.add(this._waitForSameDocumentNavigation());
    const requestWatcher = disposer.add(this._trackDocumentRequests());
    let navigateResult: GotoResult;
    const navigate = async () => {
      try {
        navigateResult = await this._page._delegate.navigateFrame(this, url, referer);
      } catch (error) {
        return error;
      }
    };

    throwIfError(await Promise.race([
      navigate(),
      timeoutPromise,
      frameDestroyedPromise,
    ]));

    const promises: Promise<Error|void>[] = [timeoutPromise, frameDestroyedPromise];
    if (navigateResult!.newDocumentId)
      promises.push(disposer.add(this._waitForSpecificDocument(navigateResult!.newDocumentId)));
    else
      promises.push(sameDocumentPromise);
    throwIfError(await Promise.race(promises));

    const request = (navigateResult! && navigateResult!.newDocumentId) ? requestWatcher.get(navigateResult!.newDocumentId) : null;
    const waitForLifecyclePromise = disposer.add(this._waitForLifecycle(options.waitUntil));
    throwIfError(await Promise.race([timeoutPromise, frameDestroyedPromise, waitForLifecyclePromise]));

    disposer.dispose();

    return request ? request._finalRequest._waitForResponse() : null;

    function throwIfError(error: Error|void): asserts error is void {
      if (!error)
        return;
      disposer.dispose();
      const message = `While navigating to ${url}: ${error.message}`;
      if (error instanceof TimeoutError)
        throw new TimeoutError(message);
      throw new Error(message);
    }
  }

  async waitForNavigation(options: WaitForNavigationOptions = {}): Promise<network.Response | null> {
    const disposer = new Disposer();
    const requestWatcher = disposer.add(this._trackDocumentRequests());
    const {timeout = this._page._timeoutSettings.navigationTimeout()} = options;

    const failurePromise = Promise.race([
      this._createFrameDestroyedPromise(),
      disposer.add(createTimeoutPromise(timeout)),
    ]);
    let documentId: string|null = null;
    let error: void|Error = await Promise.race([
      failurePromise,
      disposer.add(this._waitForNewDocument(options.url)).then(result => {
        if (result.error)
          return result.error;
        documentId = result.documentId;
      }),
      disposer.add(this._waitForSameDocumentNavigation(options.url)),
    ]);
    const request = requestWatcher.get(documentId!);
    if (!error) {
      error = await Promise.race([
        failurePromise,
        disposer.add(this._waitForLifecycle(options.waitUntil)),
      ]);
    }
    disposer.dispose();
    if (error)
      throw error;
    return request ? request._finalRequest._waitForResponse() : null;
  }

  async waitForLoadState(options: NavigateOptions = {}): Promise<void> {
    const {timeout = this._page._timeoutSettings.navigationTimeout()} = options;
    const disposer = new Disposer();
    const error = await Promise.race([
      this._createFrameDestroyedPromise(),
      disposer.add(createTimeoutPromise(timeout)),
      disposer.add(this._waitForLifecycle(options.waitUntil)),
    ]);
    disposer.dispose();
    if (error)
      throw error;
  }

  _waitForSpecificDocument(expectedDocumentId: string): Disposable<Promise<Error|void>> {
    let resolve: (error: Error|void) => void;
    const promise = new Promise<Error|void>(x => resolve = x);
    const watch = (documentId: string, error?: Error) => {
      if (documentId === expectedDocumentId)
        resolve(error);
      else if (!error)
        resolve(new Error('Navigation interrupted by another one'));
    };
    const dispose = () => this._documentWatchers.delete(watch);
    this._documentWatchers.add(watch);
    return {value: promise, dispose};
  }

  _waitForNewDocument(url?: types.URLMatch): Disposable<Promise<{error?: Error, documentId: string}>> {
    let resolve: (error: {error?: Error, documentId: string}) => void;
    const promise = new Promise<{error?: Error, documentId: string}>(x => resolve = x);
    const watch = (documentId: string, error?: Error) => {
      if (!error && !platform.urlMatches(this.url(), url))
        return;
      resolve({error, documentId});
    };
    const dispose = () => this._documentWatchers.delete(watch);
    this._documentWatchers.add(watch);
    return {value: promise, dispose};
  }

  _waitForSameDocumentNavigation(url?: types.URLMatch): Disposable<Promise<void>> {
    let resolve: () => void;
    const promise = new Promise<void>(x => resolve = x);
    const watch = () => {
      if (platform.urlMatches(this.url(), url))
        resolve();
    };
    const dispose = () => this._sameDocumentNavigationWatchers.delete(watch);
    this._sameDocumentNavigationWatchers.add(watch);
    return {value: promise, dispose};
  }

  _waitForLifecycle(waitUntil: LifecycleEvent|LifecycleEvent[] = 'load'): Disposable<Promise<void>> {
    let resolve: () => void;
    const expectedLifecycle = typeof waitUntil === 'string' ? [waitUntil] : waitUntil;
    for (const event of expectedLifecycle) {
      if (!kLifecycleEvents.has(event))
        throw new Error(`Unsupported waitUntil option ${String(event)}`);
    }

    const checkLifecycleComplete = () => {
      if (!checkLifecycleRecursively(this))
        return;
      resolve();
    };

    const promise = new Promise<void>(x => resolve = x);
    const dispose = () => this._page._frameManager._lifecycleWatchers.delete(checkLifecycleComplete);
    this._page._frameManager._lifecycleWatchers.add(checkLifecycleComplete);
    checkLifecycleComplete();
    return {value: promise, dispose};

    function checkLifecycleRecursively(frame: Frame): boolean {
      for (const event of expectedLifecycle) {
        if (!frame._firedLifecycleEvents.has(event))
          return false;
      }
      for (const child of frame.childFrames()) {
        if (!checkLifecycleRecursively(child))
          return false;
      }
      return true;
    }
  }

  _trackDocumentRequests(): Disposable<Map<string, network.Request>> {
    const requestMap = new Map<string, network.Request>();
    const dispose = () => {
      this._requestWatchers.delete(onRequest);
    };
    const onRequest = (request: network.Request) => {
      if (!request._documentId || request.redirectChain().length)
        return;
      requestMap.set(request._documentId, request);
    };
    this._requestWatchers.add(onRequest);
    return {dispose, value: requestMap};
  }

  _createFrameDestroyedPromise(): Promise<Error> {
    return Promise.race([
      this._page._disconnectedPromise.then(() => new Error('Navigation failed because browser has disconnected!')),
      this._detachedPromise.then(() => new Error('Navigating frame was detached!')),
    ]);
  }

  async frameElement(): Promise<dom.ElementHandle> {
    return this._page._delegate.getFrameElement(this);
  }

  _context(contextType: ContextType): Promise<dom.FrameExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._contextData.get(contextType)!.contextPromise;
  }

  _mainContext(): Promise<dom.FrameExecutionContext> {
    return this._context('main');
  }

  _utilityContext(): Promise<dom.FrameExecutionContext> {
    return this._context('utility');
  }

  evaluateHandle: types.EvaluateHandle = async (pageFunction, ...args) => {
    const context = await this._mainContext();
    return context.evaluateHandle(pageFunction, ...args as any);
  }

  evaluate: types.Evaluate = async (pageFunction, ...args) => {
    const context = await this._mainContext();
    return context.evaluate(pageFunction, ...args as any);
  }

  async $(selector: string): Promise<dom.ElementHandle<Element> | null> {
    const utilityContext = await this._utilityContext();
    const mainContext = await this._mainContext();
    const handle = await utilityContext._$(selector);
    if (handle && handle._context !== mainContext) {
      const adopted = this._page._delegate.adoptElementHandle(handle, mainContext);
      await handle.dispose();
      return adopted;
    }
    return handle;
  }

  async waitForSelector(selector: string, options?: types.TimeoutOptions & { visibility?: types.Visibility }): Promise<dom.ElementHandle<Element> | null> {
    const { timeout = this._page._timeoutSettings.timeout(), visibility = 'any' } = (options || {});
    const handle = await this._waitForSelectorInUtilityContext(selector, visibility, timeout);
    const mainContext = await this._mainContext();
    if (handle && handle._context !== mainContext) {
      const adopted = this._page._delegate.adoptElementHandle(handle, mainContext);
      await handle.dispose();
      return adopted;
    }
    return handle;
  }

  async $wait(selector: string, options?: types.TimeoutOptions & { visibility?: types.Visibility }): Promise<dom.ElementHandle<Element> | null> {
    return this.waitForSelector(selector, options);
  }

  $eval: types.$Eval = async (selector, pageFunction, ...args) => {
    const context = await this._mainContext();
    const elementHandle = await context._$(selector);
    if (!elementHandle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await elementHandle.evaluate(pageFunction, ...args as any);
    await elementHandle.dispose();
    return result;
  }

  $$eval: types.$$Eval = async (selector, pageFunction, ...args) => {
    const context = await this._mainContext();
    const arrayHandle = await context._$array(selector);
    const result = await arrayHandle.evaluate(pageFunction, ...args as any);
    await arrayHandle.dispose();
    return result;
  }

  async $$(selector: string): Promise<dom.ElementHandle<Element>[]> {
    const context = await this._mainContext();
    return context._$$(selector);
  }

  async content(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluate(() => {
      let retVal = '';
      if (document.doctype)
        retVal = new XMLSerializer().serializeToString(document.doctype);
      if (document.documentElement)
        retVal += document.documentElement.outerHTML;
      return retVal;
    });
  }

  async setContent(html: string, options?: NavigateOptions): Promise<void> {
    const tag = `--playwright--set--content--${this._id}--${++this._setContentCounter}--`;
    const context = await this._utilityContext();
    const lifecyclePromise = new Promise(resolve => {
      this._page._frameManager._consoleMessageTags.set(tag, () => {
        // Clear lifecycle right after document.open() - see 'tag' below.
        this._page._frameManager.clearFrameLifecycle(this);
        resolve(this.waitForLoadState(options));
      });
    });
    const contentPromise = context.evaluate((html, tag) => {
      window.stop();
      document.open();
      console.debug(tag);  // eslint-disable-line no-console
      document.write(html);
      document.close();
    }, html, tag);
    await Promise.all([contentPromise, lifecyclePromise]);
  }

  name(): string {
    return this._name || '';
  }

  url(): string {
    return this._url;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  isDetached(): boolean {
    return this._detached;
  }

  async addScriptTag(options: {
      url?: string; path?: string;
      content?: string;
      type?: string;
    }): Promise<dom.ElementHandle> {
    const {
      url = null,
      path = null,
      content = null,
      type = ''
    } = options;
    if (!url && !path && !content)
      throw new Error('Provide an object with a `url`, `path` or `content` property');

    const context = await this._mainContext();
    return this._raceWithCSPError(async () => {
      if (url !== null)
        return (await context.evaluateHandle(addScriptUrl, url, type)).asElement()!;
      if (path !== null) {
        let contents = await platform.readFileAsync(path, 'utf8');
        contents += '//# sourceURL=' + path.replace(/\n/g, '');
        return (await context.evaluateHandle(addScriptContent, contents, type)).asElement()!;
      }
      return (await context.evaluateHandle(addScriptContent, content!, type)).asElement()!;
    });

    async function addScriptUrl(url: string, type: string): Promise<HTMLElement> {
      const script = document.createElement('script');
      script.src = url;
      if (type)
        script.type = type;
      const promise = new Promise((res, rej) => {
        script.onload = res;
        script.onerror = rej;
      });
      document.head.appendChild(script);
      await promise;
      return script;
    }

    function addScriptContent(content: string, type: string = 'text/javascript'): HTMLElement {
      const script = document.createElement('script');
      script.type = type;
      script.text = content;
      let error = null;
      script.onerror = e => error = e;
      document.head.appendChild(script);
      if (error)
        throw error;
      return script;
    }
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<dom.ElementHandle> {
    const {
      url = null,
      path = null,
      content = null
    } = options;
    if (!url && !path && !content)
      throw new Error('Provide an object with a `url`, `path` or `content` property');

    const context = await this._mainContext();
    return this._raceWithCSPError(async () => {
      if (url !== null)
        return (await context.evaluateHandle(addStyleUrl, url)).asElement()!;

      if (path !== null) {
        let contents = await platform.readFileAsync(path, 'utf8');
        contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
        return (await context.evaluateHandle(addStyleContent, contents)).asElement()!;
      }

      return (await context.evaluateHandle(addStyleContent, content!)).asElement()!;
    });

    async function addStyleUrl(url: string): Promise<HTMLElement> {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      const promise = new Promise((res, rej) => {
        link.onload = res;
        link.onerror = rej;
      });
      document.head.appendChild(link);
      await promise;
      return link;
    }

    async function addStyleContent(content: string): Promise<HTMLElement> {
      const style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(content));
      const promise = new Promise((res, rej) => {
        style.onload = res;
        style.onerror = rej;
      });
      document.head.appendChild(style);
      await promise;
      return style;
    }
  }

  private async _raceWithCSPError(func: () => Promise<dom.ElementHandle>): Promise<dom.ElementHandle> {
    const listeners: RegisteredListener[] = [];
    let result: dom.ElementHandle;
    let error: Error | undefined;
    let cspMessage: ConsoleMessage | undefined;
    const actionPromise = new Promise<dom.ElementHandle>(async resolve => {
      try {
        result = await func();
      } catch (e) {
        error = e;
      }
      resolve();
    });
    const errorPromise = new Promise(resolve => {
      listeners.push(helper.addEventListener(this._page, Events.Page.Console, (message: ConsoleMessage) => {
        if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
          cspMessage = message;
          resolve();
        }
      }));
    });
    await Promise.race([actionPromise, errorPromise]);
    helper.removeEventListeners(listeners);
    if (cspMessage)
      throw new Error(cspMessage.text());
    if (error)
      throw error;
    return result!;
  }

  async click(selector: string, options?: dom.ClickOptions & types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.click(options);
    await handle.dispose();
  }

  async dblclick(selector: string, options?: dom.MultiClickOptions & types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.dblclick(options);
    await handle.dispose();
  }

  async tripleclick(selector: string, options?: dom.MultiClickOptions & types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.tripleclick(options);
    await handle.dispose();
  }

  async fill(selector: string, value: string, options?: types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.fill(value);
    await handle.dispose();
  }

  async focus(selector: string, options?: types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.focus();
    await handle.dispose();
  }

  async hover(selector: string, options?: dom.PointerActionOptions & types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.hover(options);
    await handle.dispose();
  }

  async select(selector: string, value: string | dom.ElementHandle | types.SelectOption | string[] | dom.ElementHandle[] | types.SelectOption[] | undefined, options?: types.WaitForOptions): Promise<string[]> {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
    const result = await handle.select(...values);
    await handle.dispose();
    return result;
  }

  async type(selector: string, text: string, options?: { delay?: number } & types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.type(text, options);
    await handle.dispose();
  }

  async check(selector: string, options?: types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.check(options);
    await handle.dispose();
  }

  async uncheck(selector: string, options?: types.WaitForOptions) {
    const handle = await this._optionallyWaitForSelectorInUtilityContext(selector, options);
    await handle.uncheck(options);
    await handle.dispose();
  }

  async waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: types.WaitForFunctionOptions & { visibility?: types.Visibility } = {}, ...args: any[]): Promise<js.JSHandle | null> {
    if (helper.isString(selectorOrFunctionOrTimeout))
      return this.waitForSelector(selectorOrFunctionOrTimeout, options) as any;
    if (helper.isNumber(selectorOrFunctionOrTimeout))
      return new Promise(fulfill => setTimeout(fulfill, selectorOrFunctionOrTimeout));
    if (typeof selectorOrFunctionOrTimeout === 'function')
      return this.waitForFunction(selectorOrFunctionOrTimeout, options, ...args);
    return Promise.reject(new Error('Unsupported target type: ' + (typeof selectorOrFunctionOrTimeout)));
  }

  private async _optionallyWaitForSelectorInUtilityContext(selector: string, options: types.WaitForOptions | undefined): Promise<dom.ElementHandle<Element>> {
    const { timeout = this._page._timeoutSettings.timeout(), waitFor = true } = (options || {});
    if (!helper.isBoolean(waitFor))
      throw new Error('waitFor option should be a boolean, got "' + (typeof waitFor) + '"');
    let handle: dom.ElementHandle<Element>;
    if (waitFor) {
      const maybeHandle = await this._waitForSelectorInUtilityContext(selector, 'any', timeout);
      if (!maybeHandle)
        throw new Error('No node found for selector: ' + selectorToString(selector, 'any'));
      handle = maybeHandle;
    } else {
      const context = await this._context('utility');
      const maybeHandle = await context._$(selector);
      assert(maybeHandle, 'No node found for selector: ' + selector);
      handle = maybeHandle;
    }
    return handle;
  }

  private async _waitForSelectorInUtilityContext(selector: string, waitFor: types.Visibility, timeout: number): Promise<dom.ElementHandle<Element> | null> {
    let visibility: types.Visibility = 'any';
    if (waitFor === 'visible' || waitFor === 'hidden' || waitFor === 'any')
      visibility = waitFor;
    else
      throw new Error(`Unsupported visibility option "${waitFor}"`);
    const task = dom.waitForSelectorTask(selector, visibility, timeout);
    const result = await this._scheduleRerunnableTask(task, 'utility', timeout, `selector "${selectorToString(selector, visibility)}"`);
    if (!result.asElement()) {
      await result.dispose();
      return null;
    }
    return result.asElement() as dom.ElementHandle<Element>;
  }

  async waitForFunction(pageFunction: Function | string, options?: types.WaitForFunctionOptions, ...args: any[]): Promise<js.JSHandle> {
    options = { timeout: this._page._timeoutSettings.timeout(), ...(options || {}) };
    const task = dom.waitForFunctionTask(undefined, pageFunction, options, ...args);
    return this._scheduleRerunnableTask(task, 'main', options.timeout);
  }

  async title(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluate(() => document.title);
  }

  _onDetached() {
    this._detached = true;
    this._detachedCallback();
    for (const data of this._contextData.values()) {
      for (const rerunnableTask of data.rerunnableTasks)
        rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    }
    if (this._parentFrame)
      this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  private _scheduleRerunnableTask(task: dom.Task, contextType: ContextType, timeout?: number, title?: string): Promise<js.JSHandle> {
    const data = this._contextData.get(contextType)!;
    const rerunnableTask = new RerunnableTask(data, task, timeout, title);
    data.rerunnableTasks.add(rerunnableTask);
    if (data.context)
      rerunnableTask.rerun(data.context);
    return rerunnableTask.promise;
  }

  private _setContext(contextType: ContextType, context: dom.FrameExecutionContext | null) {
    const data = this._contextData.get(contextType)!;
    data.context = context;
    if (context) {
      data.contextResolveCallback.call(null, context);
      for (const rerunnableTask of data.rerunnableTasks)
        rerunnableTask.rerun(context);
    } else {
      data.contextPromise = new Promise(fulfill => {
        data.contextResolveCallback = fulfill;
      });
    }
  }

  _contextCreated(contextType: ContextType, context: dom.FrameExecutionContext) {
    const data = this._contextData.get(contextType)!;
    // In case of multiple sessions to the same target, there's a race between
    // connections so we might end up creating multiple isolated worlds.
    // We can use either.
    if (data.context)
      this._setContext(contextType, null);
    this._setContext(contextType, context);
  }

  _contextDestroyed(context: dom.FrameExecutionContext) {
    for (const [contextType, data] of this._contextData) {
      if (data.context === context)
        this._setContext(contextType, null);
    }
  }
}

class RerunnableTask {
  readonly promise: Promise<js.JSHandle>;
  private _contextData: ContextData;
  private _task: dom.Task;
  private _runCount: number;
  private _resolve: (result: js.JSHandle) => void = () => {};
  private _reject: (reason: Error) => void = () => {};
  private _timeoutTimer?: NodeJS.Timer;
  private _terminated = false;

  constructor(data: ContextData, task: dom.Task, timeout?: number, title?: string) {
    this._contextData = data;
    this._task = task;
    this._runCount = 0;
    this.promise = new Promise<js.JSHandle>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    // Since page navigation requires us to re-install the pageScript, we should track
    // timeout on our end.
    if (timeout) {
      const timeoutError = new TimeoutError(`waiting for ${title || 'function'} failed: timeout ${timeout}ms exceeded`);
      this._timeoutTimer = setTimeout(() => this.terminate(timeoutError), timeout);
    }
  }

  terminate(error: Error) {
    this._terminated = true;
    this._reject(error);
    this._doCleanup();
  }

  async rerun(context: dom.FrameExecutionContext) {
    const runCount = ++this._runCount;
    let success: js.JSHandle | null = null;
    let error = null;
    try {
      success = await this._task(context);
    } catch (e) {
      error = e;
    }

    if (this._terminated || runCount !== this._runCount) {
      if (success)
        await success.dispose();
      return;
    }

    // Ignore timeouts in pageScript - we track timeouts ourselves.
    // If execution context has been already destroyed, `context.evaluate` will
    // throw an error - ignore this predicate run altogether.
    if (!error && await context.evaluate(s => !s, success).catch(e => true)) {
      await success!.dispose();
      return;
    }

    // When the page is navigated, the promise is rejected.
    // We will try again in the new execution context.
    if (error && error.message.includes('Execution context was destroyed'))
      return;

    // We could have tried to evaluate in a context which was already
    // destroyed.
    if (error && error.message.includes('Cannot find context with specified id'))
      return;

    if (error)
      this._reject(error);
    else
      this._resolve(success!);

    this._doCleanup();
  }

  _doCleanup() {
    if (this._timeoutTimer)
      clearTimeout(this._timeoutTimer);
    this._contextData.rerunnableTasks.delete(this);
  }
}

type Disposable<T> = {value: T, dispose: () => void};
class Disposer {
  private _disposes: (() => void)[] = [];
  add<T>({value, dispose}: Disposable<T>) {
    this._disposes.push(dispose);
    return value;
  }
  dispose() {
    for (const dispose of this._disposes)
      dispose();
    this._disposes = [];
  }
}

function createTimeoutPromise(timeout: number): Disposable<Promise<TimeoutError>> {
  if (!timeout)
    return { value: new Promise(() => {}), dispose: () => void 0 };

  let timer: NodeJS.Timer;
  const errorMessage = 'Navigation timeout of ' + timeout + ' ms exceeded';
  const promise = new Promise(fulfill => timer = setTimeout(fulfill, timeout))
      .then(() => new TimeoutError(errorMessage));
  const dispose = () => {
    clearTimeout(timer);
  };
  return {
    value: promise,
    dispose
  };
}

function selectorToString(selector: string, visibility: types.Visibility): string {
  let label;
  switch (visibility) {
    case 'visible': label = '[visible] '; break;
    case 'hidden': label = '[hidden] '; break;
    case 'any':
    case undefined:
      label = ''; break;
  }
  return `${label}${selector}`;
}
