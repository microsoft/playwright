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

import * as fs from 'fs';
import * as util from 'util';
import { ConsoleMessage } from './console';
import * as dom from './dom';
import { TimeoutError, NotConnectedError } from './errors';
import { Events } from './events';
import { assert, helper, RegisteredListener, assertMaxArguments } from './helper';
import * as js from './javascript';
import * as network from './network';
import { Page } from './page';
import { selectors } from './selectors';
import * as types from './types';
import { waitForTimeoutWasUsed } from './hints';

type ContextType = 'main' | 'utility';
type ContextData = {
  contextPromise: Promise<dom.FrameExecutionContext>;
  contextResolveCallback: (c: dom.FrameExecutionContext) => void;
  context: dom.FrameExecutionContext | null;
  rerunnableTasks: Set<RerunnableTask>;
};

export type GotoOptions = types.NavigateOptions & {
  referer?: string,
};
export type GotoResult = {
  newDocumentId?: string,
};

type ConsoleTagHandler = () => void;

export class FrameManager {
  private _page: Page;
  private _frames = new Map<string, Frame>();
  private _mainFrame: Frame;
  readonly _consoleMessageTags = new Map<string, ConsoleTagHandler>();
  readonly _signalBarriers = new Set<SignalBarrier>();

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

  async waitForSignalsCreatedBy<T>(action: () => Promise<T>, deadline: number, options: types.NavigatingActionWaitOptions = {}, input?: boolean): Promise<T> {
    if (options.noWaitAfter)
      return action();
    const barrier = new SignalBarrier(options, deadline);
    this._signalBarriers.add(barrier);
    try {
      const result = await action();
      if (input)
        await this._page._delegate.inputActionEpilogue();
      await barrier.waitFor();
      // Resolve in the next task, after all waitForNavigations.
      await new Promise(helper.makeWaitForNextTask());
      return result;
    } finally {
      this._signalBarriers.delete(barrier);
    }
  }

  frameWillPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers)
      barrier.retain();
  }

  frameDidPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers)
      barrier.release();
  }

  frameRequestedNavigation(frameId: string, documentId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    for (const barrier of this._signalBarriers)
      barrier.addFrameNavigation(frame);
    frame._pendingDocumentId = documentId;
  }

  frameUpdatedDocumentIdForNavigation(frameId: string, documentId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._pendingDocumentId = documentId;
  }

  frameCommittedNewDocumentNavigation(frameId: string, url: string, name: string, documentId: string, initial: boolean) {
    const frame = this._frames.get(frameId)!;
    this.removeChildFramesRecursively(frame);
    frame._url = url;
    frame._name = name;
    assert(!frame._pendingDocumentId || frame._pendingDocumentId === documentId);
    frame._lastDocumentId = documentId;
    frame._pendingDocumentId = '';
    for (const task of frame._frameTasks)
      task.onNewDocument(documentId);
    this.clearFrameLifecycle(frame);
    if (!initial)
      this._page.emit(Events.Page.FrameNavigated, frame);
  }

  frameCommittedSameDocumentNavigation(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._url = url;
    for (const task of frame._frameTasks)
      task.onSameDocument();
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
    this._notifyLifecycle(frame);
    if (frame === this.mainFrame() && !hasDOMContentLoaded)
      this._page.emit(Events.Page.DOMContentLoaded);
    if (frame === this.mainFrame() && !hasLoad)
      this._page.emit(Events.Page.Load);
  }

  frameLifecycleEvent(frameId: string, event: types.LifecycleEvent) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._firedLifecycleEvents.add(event);
    this._notifyLifecycle(frame);
    if (frame === this._mainFrame && event === 'load')
      this._page.emit(Events.Page.Load);
    if (frame === this._mainFrame && event === 'domcontentloaded')
      this._page.emit(Events.Page.DOMContentLoaded);
  }

  clearFrameLifecycle(frame: Frame) {
    frame._firedLifecycleEvents.clear();
    // Keep the current navigation request if any.
    frame._inflightRequests = new Set(Array.from(frame._inflightRequests).filter(request => request._documentId === frame._lastDocumentId));
    frame._stopNetworkIdleTimer();
    if (frame._inflightRequests.size === 0)
      frame._startNetworkIdleTimer();
  }

  requestStarted(request: network.Request) {
    this._inflightRequestStarted(request);
    for (const task of request.frame()._frameTasks)
      task.onRequest(request);
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
    if (request._documentId) {
      const isPendingDocument = request.frame()._pendingDocumentId === request._documentId;
      if (isPendingDocument) {
        request.frame()._pendingDocumentId = '';
        let errorText = request.failure()!.errorText;
        if (canceled)
          errorText += '; maybe frame was detached?';
        for (const task of request.frame()._frameTasks)
          task.onNewDocument(request._documentId, new Error(errorText));
      }
    }
    if (!request._isFavicon)
      this._page.emit(Events.Page.RequestFailed, request);
  }

  provisionalLoadFailed(frame: Frame, documentId: string, error: string) {
    for (const task of frame._frameTasks)
      task.onNewDocument(documentId, new Error(error));
  }

  private _notifyLifecycle(frame: Frame) {
    for (let parent: Frame | null = frame; parent; parent = parent.parentFrame()) {
      for (const frameTask of parent._frameTasks)
        frameTask.onLifecycle();
    }
  }

  removeChildFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
  }

  private _removeFramesRecursively(frame: Frame) {
    this.removeChildFramesRecursively(frame);
    frame._onDetached();
    this._frames.delete(frame._id);
    this._page.emit(Events.Page.FrameDetached, frame);
  }

  private _inflightRequestFinished(request: network.Request) {
    const frame = request.frame();
    if (request._isFavicon)
      return;
    if (!frame._inflightRequests.has(request))
      return;
    frame._inflightRequests.delete(request);
    if (frame._inflightRequests.size === 0)
      frame._startNetworkIdleTimer();
  }

  private _inflightRequestStarted(request: network.Request) {
    const frame = request.frame();
    if (request._isFavicon)
      return;
    frame._inflightRequests.add(request);
    if (frame._inflightRequests.size === 1)
      frame._stopNetworkIdleTimer();
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
  readonly _firedLifecycleEvents: Set<types.LifecycleEvent>;
  _lastDocumentId = '';
  _pendingDocumentId = '';
  _frameTasks = new Set<FrameTask>();
  readonly _page: Page;
  private _parentFrame: Frame | null;
  _url = '';
  private _detached = false;
  private _contextData = new Map<ContextType, ContextData>();
  private _childFrames = new Set<Frame>();
  _name = '';
  _inflightRequests = new Set<network.Request>();
  private _networkIdleTimer: NodeJS.Timer | undefined;
  private _setContentCounter = 0;
  readonly _detachedPromise: Promise<void>;
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

    const frameTask = new FrameTask(this, options, url);
    const sameDocumentPromise = frameTask.waitForSameDocumentNavigation();
    const navigateResult = await frameTask.raceAgainstFailures(this._page._delegate.navigateFrame(this, url, referer)).catch(e => {
      // Do not leave sameDocumentPromise unhandled.
      sameDocumentPromise.catch(e => {});
      throw e;
    });
    if (navigateResult.newDocumentId) {
      // Do not leave sameDocumentPromise unhandled.
      sameDocumentPromise.catch(e => {});
      await frameTask.waitForSpecificDocument(navigateResult.newDocumentId);
    } else {
      await sameDocumentPromise;
    }
    const request = (navigateResult && navigateResult.newDocumentId) ? frameTask.request(navigateResult.newDocumentId) : null;
    await frameTask.waitForLifecycle(options.waitUntil === undefined ? 'load' : options.waitUntil);
    frameTask.done();
    return request ? request._finalRequest().response() : null;
  }

  async waitForNavigation(options: types.WaitForNavigationOptions = {}): Promise<network.Response | null> {
    return this._waitForNavigation(options);
  }

  async _waitForNavigation(options: types.ExtendedWaitForNavigationOptions = {}): Promise<network.Response | null> {
    const frameTask = new FrameTask(this, options);
    let documentId: string | undefined;
    await Promise.race([
      frameTask.waitForNewDocument(options.url).then(id => documentId = id),
      frameTask.waitForSameDocumentNavigation(options.url),
    ]);
    const request = documentId ? frameTask.request(documentId) : null;
    if (options.waitUntil !== 'commit')
      await frameTask.waitForLifecycle(options.waitUntil === undefined ? 'load' : options.waitUntil);
    frameTask.done();
    return request ? request._finalRequest().response() : null;
  }

  async waitForLoadState(state: types.LifecycleEvent = 'load', options: types.TimeoutOptions = {}): Promise<void> {
    const frameTask = new FrameTask(this, options);
    await frameTask.waitForLifecycle(state);
    frameTask.done();
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

  async evaluateHandle<R, Arg>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<types.SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: types.Func1<void, R>, arg?: any): Promise<types.SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<types.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    const context = await this._mainContext();
    return context.evaluateHandleInternal(pageFunction, arg);
  }

  async evaluate<R, Arg>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: types.Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const context = await this._mainContext();
    return context.evaluateInternal(pageFunction, arg);
  }

  async $(selector: string): Promise<dom.ElementHandle<Element> | null> {
    return selectors._query(this, selector);
  }

  async waitForSelector(selector: string, options?: types.WaitForElementOptions): Promise<dom.ElementHandle<Element> | null> {
    if (options && (options as any).visibility)
      throw new Error('options.visibility is not supported, did you mean options.waitFor?');
    const { waitFor = 'attached' } = (options || {});
    if (!['attached', 'detached', 'visible', 'hidden'].includes(waitFor))
      throw new Error(`Unsupported waitFor option "${waitFor}"`);

    const deadline = this._page._timeoutSettings.computeDeadline(options);
    const { world, task } = selectors._waitForSelectorTask(selector, waitFor, deadline);
    const result = await this._scheduleRerunnableTask(task, world, deadline, `selector "${selectorToString(selector, waitFor)}"`);
    if (!result.asElement()) {
      result.dispose();
      return null;
    }
    const handle = result.asElement() as dom.ElementHandle<Element>;
    const mainContext = await this._mainContext();
    if (handle && handle._context !== mainContext) {
      const adopted = await this._page._delegate.adoptElementHandle(handle, mainContext);
      handle.dispose();
      return adopted;
    }
    return handle;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: Object, options?: types.TimeoutOptions): Promise<void> {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    const task = selectors._dispatchEventTask(selector, type, eventInit || {}, deadline);
    const result = await this._scheduleRerunnableTask(task, 'main', deadline, `selector "${selectorToString(selector, 'attached')}"`);
    result.dispose();
  }

  async $eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: types.FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const handle = await this.$(selector);
    if (!handle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await handle.evaluate(pageFunction, arg);
    handle.dispose();
    return result;
  }

  async $$eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: types.FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: types.FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const arrayHandle = await selectors._queryArray(this, selector);
    const result = await arrayHandle.evaluate(pageFunction, arg);
    arrayHandle.dispose();
    return result;
  }

  async $$(selector: string): Promise<dom.ElementHandle<Element>[]> {
    return selectors._queryAll(this, selector);
  }

  async content(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluateInternal(() => {
      let retVal = '';
      if (document.doctype)
        retVal = new XMLSerializer().serializeToString(document.doctype);
      if (document.documentElement)
        retVal += document.documentElement.outerHTML;
      return retVal;
    });
  }

  async setContent(html: string, options?: types.NavigateOptions): Promise<void> {
    const tag = `--playwright--set--content--${this._id}--${++this._setContentCounter}--`;
    const context = await this._utilityContext();
    const lifecyclePromise = new Promise((resolve, reject) => {
      this._page._frameManager._consoleMessageTags.set(tag, () => {
        // Clear lifecycle right after document.open() - see 'tag' below.
        this._page._frameManager.clearFrameLifecycle(this);
        this.waitForLoadState(options ? options.waitUntil : 'load', options).then(resolve).catch(reject);
      });
    });
    const contentPromise = context.evaluateInternal(({ html, tag }) => {
      window.stop();
      document.open();
      console.debug(tag);  // eslint-disable-line no-console
      document.write(html);
      document.close();
    }, { html, tag });
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
        return (await context.evaluateHandleInternal(addScriptUrl, { url, type })).asElement()!;
      let result;
      if (path !== null) {
        let contents = await util.promisify(fs.readFile)(path, 'utf8');
        contents += '//# sourceURL=' + path.replace(/\n/g, '');
        result = (await context.evaluateHandleInternal(addScriptContent, { content: contents, type })).asElement()!;
      } else {
        result = (await context.evaluateHandleInternal(addScriptContent, { content: content!, type })).asElement()!;
      }
      // Another round trip to the browser to ensure that we receive CSP error messages
      // (if any) logged asynchronously in a separate task on the content main thread.
      if (this._page._delegate.cspErrorsAsynchronousForInlineScipts)
        await context.evaluateInternal(() => true);
      return result;
    });

    async function addScriptUrl(options: { url: string, type: string }): Promise<HTMLElement> {
      const script = document.createElement('script');
      script.src = options.url;
      if (options.type)
        script.type = options.type;
      const promise = new Promise((res, rej) => {
        script.onload = res;
        script.onerror = e => rej(typeof e === 'string' ? new Error(e) : new Error(`Failed to load script at ${script.src}`));
      });
      document.head.appendChild(script);
      await promise;
      return script;
    }

    function addScriptContent(options: { content: string, type: string }): HTMLElement {
      const script = document.createElement('script');
      script.type = options.type || 'text/javascript';
      script.text = options.content;
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
        return (await context.evaluateHandleInternal(addStyleUrl, url)).asElement()!;

      if (path !== null) {
        let contents = await util.promisify(fs.readFile)(path, 'utf8');
        contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
        return (await context.evaluateHandleInternal(addStyleContent, contents)).asElement()!;
      }

      return (await context.evaluateHandleInternal(addStyleContent, content!)).asElement()!;
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

  private async _retryWithSelectorIfNotConnected<R>(
    selector: string, options: types.TimeoutOptions,
    action: (handle: dom.ElementHandle<Element>, deadline: number) => Promise<R>): Promise<R> {
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    while (!helper.isPastDeadline(deadline)) {
      try {
        const { world, task } = selectors._waitForSelectorTask(selector, 'attached', deadline);
        const handle = await this._scheduleRerunnableTask(task, world, deadline, `selector "${selector}"`);
        const element = handle.asElement() as dom.ElementHandle<Element>;
        try {
          return await action(element, deadline);
        } finally {
          element.dispose();
        }
      } catch (e) {
        if (!(e instanceof NotConnectedError))
          throw e;
        this._page._log(dom.inputLog, 'Element was detached from the DOM, retrying');
      }
    }
    throw new TimeoutError(`waiting for selector "${selector}" failed: timeout exceeded`);
  }

  async click(selector: string, options: dom.ClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.click(helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async dblclick(selector: string, options: dom.MultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.dblclick(helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async fill(selector: string, value: string, options: types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.fill(value, helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async focus(selector: string, options: types.TimeoutOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.focus());
  }

  async hover(selector: string, options: dom.PointerActionOptions & types.PointerActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.hover(helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async selectOption(selector: string, values: string | dom.ElementHandle | types.SelectOption | string[] | dom.ElementHandle[] | types.SelectOption[], options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.selectOption(values, helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async setInputFiles(selector: string, files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.setInputFiles(files, helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async type(selector: string, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.type(text, helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async press(selector: string, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.press(key, helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async check(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.check(helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async uncheck(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options,
        (handle, deadline) => handle.uncheck(helper.optionsWithUpdatedTimeout(options, deadline)));
  }

  async waitForTimeout(timeout: number) {
    waitForTimeoutWasUsed(this._page);
    await new Promise(fulfill => setTimeout(fulfill, timeout));
  }

  async waitForFunction<R, Arg>(pageFunction: types.Func1<Arg, R>, arg: Arg, options?: types.WaitForFunctionOptions): Promise<types.SmartHandle<R>>;
  async waitForFunction<R>(pageFunction: types.Func1<void, R>, arg?: any, options?: types.WaitForFunctionOptions): Promise<types.SmartHandle<R>>;
  async waitForFunction<R, Arg>(pageFunction: types.Func1<Arg, R>, arg: Arg, options: types.WaitForFunctionOptions = {}): Promise<types.SmartHandle<R>> {
    const { polling = 'raf' } = options;
    const deadline = this._page._timeoutSettings.computeDeadline(options);
    if (helper.isString(polling))
      assert(polling === 'raf', 'Unknown polling option: ' + polling);
    else if (helper.isNumber(polling))
      assert(polling > 0, 'Cannot poll with non-positive interval: ' + polling);
    else
      throw new Error('Unknown polling options: ' + polling);
    const predicateBody = helper.isString(pageFunction) ? 'return (' + pageFunction + ')' : 'return (' + pageFunction + ')(arg)';

    const task = async (context: dom.FrameExecutionContext) => context.evaluateHandleInternal(({ injected, predicateBody, polling, timeout, arg }) => {
      const innerPredicate = new Function('arg', predicateBody);
      return injected.poll(polling, timeout, () => innerPredicate(arg));
    }, { injected: await context._injected(), predicateBody, polling, timeout: helper.timeUntilDeadline(deadline), arg });
    return this._scheduleRerunnableTask(task, 'main', deadline) as any as types.SmartHandle<R>;
  }

  async title(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluateInternal(() => document.title);
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

  private _scheduleRerunnableTask(task: Task, contextType: ContextType, deadline: number, title?: string): Promise<js.JSHandle> {
    const data = this._contextData.get(contextType)!;
    const rerunnableTask = new RerunnableTask(data, task, deadline, title);
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

  _startNetworkIdleTimer() {
    assert(!this._networkIdleTimer);
    if (this._firedLifecycleEvents.has('networkidle'))
      return;
    this._networkIdleTimer = setTimeout(() => { this._page._frameManager.frameLifecycleEvent(this._id, 'networkidle'); }, 500);
  }

  _stopNetworkIdleTimer() {
    if (this._networkIdleTimer)
      clearTimeout(this._networkIdleTimer);
    this._networkIdleTimer = undefined;
  }
}

type Task = (context: dom.FrameExecutionContext) => Promise<js.JSHandle>;

class RerunnableTask {
  readonly promise: Promise<js.JSHandle>;
  private _contextData: ContextData;
  private _task: Task;
  private _runCount: number;
  private _resolve: (result: js.JSHandle) => void = () => {};
  private _reject: (reason: Error) => void = () => {};
  private _timeoutTimer?: NodeJS.Timer;
  private _terminated = false;

  constructor(data: ContextData, task: Task, deadline: number, title?: string) {
    this._contextData = data;
    this._task = task;
    this._runCount = 0;
    this.promise = new Promise<js.JSHandle>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    // Since page navigation requires us to re-install the pageScript, we should track
    // timeout on our end.
    const timeoutError = new TimeoutError(`waiting for ${title || 'function'} failed: timeout exceeded`);
    this._timeoutTimer = setTimeout(() => this.terminate(timeoutError), helper.timeUntilDeadline(deadline));
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
        success.dispose();
      return;
    }

    // Ignore timeouts in pageScript - we track timeouts ourselves.
    // If execution context has been already destroyed, `context.evaluate` will
    // throw an error - ignore this predicate run altogether.
    if (!error && await context.evaluateInternal(s => !s, success).catch(e => true)) {
      success!.dispose();
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

function selectorToString(selector: string, waitFor: 'attached' | 'detached' | 'visible' | 'hidden'): string {
  let label;
  switch (waitFor) {
    case 'visible': label = '[visible] '; break;
    case 'hidden': label = '[hidden] '; break;
    case 'attached': label = ''; break;
    case 'detached': label = '[detached]'; break;
  }
  return `${label}${selector}`;
}

export class SignalBarrier {
  private _frameIds = new Map<string, number>();
  private _options: types.NavigatingActionWaitOptions;
  private _protectCount = 0;
  private _expectedPopups = 0;
  private _promise: Promise<void>;
  private _promiseCallback = () => {};
  private _deadline: number;

  constructor(options: types.NavigatingActionWaitOptions, deadline: number) {
    this._options = options;
    this._deadline = deadline;
    this._promise = new Promise(f => this._promiseCallback = f);
    this.retain();
  }

  waitFor(): Promise<void> {
    this.release();
    return this._promise;
  }

  async addFrameNavigation(frame: Frame) {
    this.retain();
    const options = helper.optionsWithUpdatedTimeout(this._options, this._deadline);
    await frame._waitForNavigation({...options, waitUntil: 'commit'}).catch(e => {});
    this.release();
  }

  async expectPopup() {
    ++this._expectedPopups;
  }

  async unexpectPopup() {
    --this._expectedPopups;
    this._maybeResolve();
  }

  async addPopup(pageOrError: Promise<Page | Error>) {
    if (this._expectedPopups)
      --this._expectedPopups;
    this.retain();
    await pageOrError;
    this.release();
  }

  retain() {
    ++this._protectCount;
  }

  release() {
    --this._protectCount;
    this._maybeResolve();
  }

  private async _maybeResolve() {
    if (!this._protectCount && !this._expectedPopups && !this._frameIds.size)
      this._promiseCallback();
  }
}

export class FrameTask {
  private _frame: Frame;
  private _failurePromise: Promise<Error>;
  private _requestMap = new Map<string, network.Request>();
  private _timer?: NodeJS.Timer;
  private _url: string | undefined;

  onNewDocument: (documentId: string, error?: Error) => void = () => {};
  onSameDocument = () => {};
  onLifecycle = () => {};

  constructor(frame: Frame, options: types.TimeoutOptions, url?: string) {
    this._frame = frame;
    this._url = url;

    // Process timeouts
    let timeoutPromise = new Promise<TimeoutError>(() => {});
    const { timeout = frame._page._timeoutSettings.navigationTimeout() } = options;
    if (timeout) {
      const errorMessage = 'Navigation timeout exceeded';
      timeoutPromise = new Promise(fulfill => this._timer = setTimeout(fulfill, timeout))
          .then(() => { throw new TimeoutError(errorMessage); });
    }

    // Process detached frames
    this._failurePromise = Promise.race([
      timeoutPromise,
      this._frame._page._disconnectedPromise.then(() => { throw new Error('Navigation failed because browser has disconnected!'); }),
      this._frame._detachedPromise.then(() => { throw new Error('Navigating frame was detached!'); }),
    ]);

    frame._frameTasks.add(this);
  }

  onRequest(request: network.Request) {
    if (!request._documentId || request.redirectedFrom())
      return;
    this._requestMap.set(request._documentId, request);
  }

  async raceAgainstFailures<T>(promise: Promise<T>): Promise<T> {
    let result: T;
    let error: Error | undefined;
    await Promise.race([
      this._failurePromise.catch(e => error = e),
      promise.then(r => result = r).catch(e => error = e)
    ]);

    if (!error)
      return result!;
    this.done();
    if (this._url)
      error.message = error.message + ` while navigating to ${this._url}`;
    throw error;
  }

  request(documentId: string): network.Request | undefined {
    return this._requestMap.get(documentId);
  }

  waitForSameDocumentNavigation(url?: types.URLMatch): Promise<void> {
    return this.raceAgainstFailures(new Promise((resolve, reject) => {
      this.onSameDocument = () => {
        if (helper.urlMatches(this._frame.url(), url))
          resolve();
      };
    }));
  }

  waitForSpecificDocument(expectedDocumentId: string): Promise<void> {
    return this.raceAgainstFailures(new Promise((resolve, reject) => {
      this.onNewDocument = (documentId: string, error?: Error) => {
        if (documentId === expectedDocumentId) {
          if (!error)
            resolve();
          else
            reject(error);
        } else if (!error) {
          reject(new Error('Navigation interrupted by another one'));
        }
      };
    }));
  }

  waitForNewDocument(url?: types.URLMatch): Promise<string> {
    return this.raceAgainstFailures(new Promise((resolve, reject) => {
      this.onNewDocument = (documentId: string, error?: Error) => {
        if (!error && !helper.urlMatches(this._frame.url(), url))
          return;
        if (error)
          reject(error);
        else
          resolve(documentId);
      };
    }));
  }

  waitForLifecycle(waitUntil: types.LifecycleEvent): Promise<void> {
    if (waitUntil as unknown === 'networkidle0')
      waitUntil = 'networkidle';
    if (!types.kLifecycleEvents.has(waitUntil))
      throw new Error(`Unsupported waitUntil option ${String(waitUntil)}`);
    return this.raceAgainstFailures(new Promise((resolve, reject) => {
      this.onLifecycle = () => {
        if (!checkLifecycleRecursively(this._frame))
          return;
        resolve();
      };
      this.onLifecycle();
    }));

    function checkLifecycleRecursively(frame: Frame): boolean {
      if (!frame._firedLifecycleEvents.has(waitUntil))
        return false;
      for (const child of frame.childFrames()) {
        if (!checkLifecycleRecursively(child))
          return false;
      }
      return true;
    }
  }

  done() {
    this._frame._frameTasks.delete(this);
    if (this._timer)
      clearTimeout(this._timer);
    this._failurePromise.catch(e => {});
  }
}
