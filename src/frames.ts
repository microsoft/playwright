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
import { Events } from './events';
import { assert, helper, RegisteredListener, assertMaxArguments, debugAssert } from './helper';
import * as js from './javascript';
import * as network from './network';
import { Page } from './page';
import { selectors } from './selectors';
import * as types from './types';
import { BrowserContext } from './browserContext';
import { Progress, ProgressController } from './progress';
import { EventEmitter } from 'events';

type ContextData = {
  contextPromise: Promise<dom.FrameExecutionContext>;
  contextResolveCallback: (c: dom.FrameExecutionContext) => void;
  context: dom.FrameExecutionContext | null;
  rerunnableTasks: Set<RerunnableTask>;
};

type DocumentInfo = {
  // Unfortunately, we don't have documentId when we find out about
  // a pending navigation from things like frameScheduledNavigaiton.
  documentId: string | undefined,
  request: network.Request | undefined,
};

export type GotoResult = {
  newDocumentId?: string,
};

type ConsoleTagHandler = () => void;

export type FunctionWithSource = (source: { context: BrowserContext, page: Page, frame: Frame}, ...args: any) => any;

export const kNavigationEvent = Symbol('navigation');
export type NavigationEvent = {
  // New frame url after navigation.
  url: string,
  // New frame name after navigation.
  name: string,
  // Information about the new document for cross-document navigations.
  // Undefined for same-document navigations.
  newDocument?: DocumentInfo,
  // Error for cross-document navigations if any. When error is present,
  // the navigation did not commit.
  error?: Error,
};
export const kAddLifecycleEvent = Symbol('addLifecycle');
export const kRemoveLifecycleEvent = Symbol('removeLifecycle');

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

  dispose() {
    for (const frame of this._frames.values())
      frame._stopNetworkIdleTimer();
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

  async waitForSignalsCreatedBy<T>(progress: Progress | null, noWaitAfter: boolean | undefined, action: () => Promise<T>, source?: 'input'): Promise<T> {
    if (noWaitAfter)
      return action();
    const barrier = new SignalBarrier(progress);
    this._signalBarriers.add(barrier);
    if (progress)
      progress.cleanupWhenAborted(() => this._signalBarriers.delete(barrier));
    const result = await action();
    if (source === 'input')
      await this._page._delegate.inputActionEpilogue();
    await barrier.waitFor();
    this._signalBarriers.delete(barrier);
    // Resolve in the next task, after all waitForNavigations.
    await new Promise(helper.makeWaitForNextTask());
    return result;
  }

  frameWillPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers)
      barrier.retain();
  }

  frameDidPotentiallyRequestNavigation() {
    for (const barrier of this._signalBarriers)
      barrier.release();
  }

  frameRequestedNavigation(frameId: string, documentId?: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    for (const barrier of this._signalBarriers)
      barrier.addFrameNavigation(frame);
    if (frame._pendingDocument && frame._pendingDocument.documentId === documentId) {
      // Do not override request with undefined.
      return;
    }
    frame._pendingDocument = { documentId, request: undefined };
  }

  frameCommittedNewDocumentNavigation(frameId: string, url: string, name: string, documentId: string, initial: boolean) {
    const frame = this._frames.get(frameId)!;
    this.removeChildFramesRecursively(frame);
    frame._url = url;
    frame._name = name;
    if (frame._pendingDocument && frame._pendingDocument.documentId === undefined)
      frame._pendingDocument.documentId = documentId;
    debugAssert(!frame._pendingDocument || frame._pendingDocument.documentId === documentId);
    if (frame._pendingDocument && frame._pendingDocument.documentId === documentId)
      frame._currentDocument = frame._pendingDocument;
    else
      frame._currentDocument = { documentId, request: undefined };
    frame._pendingDocument = undefined;
    frame._onClearLifecycle();
    const navigationEvent: NavigationEvent = { url, name, newDocument: frame._currentDocument };
    frame._eventEmitter.emit(kNavigationEvent, navigationEvent);
    if (!initial) {
      this._page._logger.info(`  navigated to "${url}"`);
      this._page.emit(Events.Page.FrameNavigated, frame);
    }
  }

  frameCommittedSameDocumentNavigation(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._url = url;
    const navigationEvent: NavigationEvent = { url, name: frame._name };
    frame._eventEmitter.emit(kNavigationEvent, navigationEvent);
    this._page._logger.info(`  navigated to "${url}"`);
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  frameAbortedNavigation(frameId: string, errorText: string, documentId?: string) {
    const frame = this._frames.get(frameId);
    if (!frame || !frame._pendingDocument)
      return;
    if (documentId !== undefined && frame._pendingDocument.documentId !== documentId)
      return;
    const navigationEvent: NavigationEvent = {
      url: frame._url,
      name: frame._name,
      newDocument: frame._pendingDocument,
      error: new Error(errorText),
    };
    frame._pendingDocument = undefined;
    frame._eventEmitter.emit(kNavigationEvent, navigationEvent);
  }

  frameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  frameStoppedLoading(frameId: string) {
    this.frameLifecycleEvent(frameId, 'domcontentloaded');
    this.frameLifecycleEvent(frameId, 'load');
  }

  frameLifecycleEvent(frameId: string, event: types.LifecycleEvent) {
    const frame = this._frames.get(frameId);
    if (frame)
      frame._onLifecycleEvent(event);
  }

  requestStarted(request: network.Request) {
    const frame = request.frame();
    this._inflightRequestStarted(request);
    if (request._documentId)
      frame._pendingDocument = { documentId: request._documentId, request };
    if (request._isFavicon) {
      const route = request._route();
      if (route)
        route.continue();
      return;
    }
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
    const frame = request.frame();
    this._inflightRequestFinished(request);
    if (frame._pendingDocument && frame._pendingDocument.request === request) {
      let errorText = request.failure()!.errorText;
      if (canceled)
        errorText += '; maybe frame was detached?';
      this.frameAbortedNavigation(frame._id, errorText, frame._pendingDocument.documentId);
    }
    if (!request._isFavicon)
      this._page.emit(Events.Page.RequestFailed, request);
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
  readonly _eventEmitter: EventEmitter;
  _id: string;
  private _firedLifecycleEvents = new Set<types.LifecycleEvent>();
  _subtreeLifecycleEvents = new Set<types.LifecycleEvent>();
  _currentDocument: DocumentInfo;
  _pendingDocument?: DocumentInfo;
  readonly _page: Page;
  private _parentFrame: Frame | null;
  _url = '';
  private _detached = false;
  private _contextData = new Map<types.World, ContextData>();
  private _childFrames = new Set<Frame>();
  _name = '';
  _inflightRequests = new Set<network.Request>();
  private _networkIdleTimer: NodeJS.Timer | undefined;
  private _setContentCounter = 0;
  readonly _detachedPromise: Promise<void>;
  private _detachedCallback = () => {};

  constructor(page: Page, id: string, parentFrame: Frame | null) {
    this._eventEmitter = new EventEmitter();
    this._eventEmitter.setMaxListeners(0);
    this._id = id;
    this._page = page;
    this._parentFrame = parentFrame;
    this._currentDocument = { documentId: undefined, request: undefined };

    this._detachedPromise = new Promise<void>(x => this._detachedCallback = x);

    this._contextData.set('main', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._contextData.set('utility', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._setContext('main', null);
    this._setContext('utility', null);

    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  private _apiName(method: string) {
    const subject = this._page._callingPageAPI  ? 'page' : 'frame';
    return `${subject}.${method}`;
  }

  _onLifecycleEvent(event: types.LifecycleEvent) {
    if (this._firedLifecycleEvents.has(event))
      return;
    this._firedLifecycleEvents.add(event);
    // Recalculate subtree lifecycle for the whole tree - it should not be that big.
    this._page.mainFrame()._recalculateLifecycle();
  }

  _onClearLifecycle() {
    this._firedLifecycleEvents.clear();
    // Recalculate subtree lifecycle for the whole tree - it should not be that big.
    this._page.mainFrame()._recalculateLifecycle();
    // Keep the current navigation request if any.
    this._inflightRequests = new Set(Array.from(this._inflightRequests).filter(request => request === this._currentDocument.request));
    this._stopNetworkIdleTimer();
    if (this._inflightRequests.size === 0)
      this._startNetworkIdleTimer();
  }

  private _recalculateLifecycle() {
    const events = new Set<types.LifecycleEvent>(this._firedLifecycleEvents);
    for (const child of this._childFrames) {
      child._recalculateLifecycle();
      // We require a particular lifecycle event to be fired in the whole
      // frame subtree, and then consider it done.
      for (const event of events) {
        if (!child._subtreeLifecycleEvents.has(event))
          events.delete(event);
      }
    }
    const mainFrame = this._page.mainFrame();
    for (const event of events) {
      // Checking whether we have already notified about this event.
      if (!this._subtreeLifecycleEvents.has(event)) {
        this._eventEmitter.emit(kAddLifecycleEvent, event);
        if (this === mainFrame && this._url !== 'about:blank')
          this._page._logger.info(`  "${event}" event fired`);
        if (this === mainFrame && event === 'load')
          this._page.emit(Events.Page.Load);
        if (this === mainFrame && event === 'domcontentloaded')
          this._page.emit(Events.Page.DOMContentLoaded);
      }
    }
    for (const event of this._subtreeLifecycleEvents) {
      if (!events.has(event))
        this._eventEmitter.emit(kRemoveLifecycleEvent, event);
    }
    this._subtreeLifecycleEvents = events;
  }

  async goto(url: string, options: types.GotoOptions = {}): Promise<network.Response | null> {
    return runNavigationTask(this, options, this._apiName('goto'), async progress => {
      const waitUntil = verifyLifecycle('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      progress.logger.info(`navigating to "${url}", waiting until "${waitUntil}"`);
      const headers = (this._page._state.extraHTTPHeaders || {});
      let referer = headers['referer'] || headers['Referer'];
      if (options.referer !== undefined) {
        if (referer !== undefined && referer !== options.referer)
          throw new Error('"referer" is already specified as extra HTTP header');
        referer = options.referer;
      }
      url = helper.completeUserURL(url);

      const sameDocument = helper.waitForEvent(progress, this._eventEmitter, kNavigationEvent, (e: NavigationEvent) => !e.newDocument);
      const navigateResult = await this._page._delegate.navigateFrame(this, url, referer);

      let event: NavigationEvent;
      if (navigateResult.newDocumentId) {
        sameDocument.dispose();
        event = await helper.waitForEvent(progress, this._eventEmitter, kNavigationEvent, (event: NavigationEvent) => {
          // We are interested either in this specific document, or any other document that
          // did commit and replaced the expected document.
          return event.newDocument && (event.newDocument.documentId === navigateResult.newDocumentId || !event.error);
        }).promise;

        if (event.newDocument!.documentId !== navigateResult.newDocumentId) {
          // This is just a sanity check. In practice, new navigation should
          // cancel the previous one and report "request cancelled"-like error.
          throw new Error('Navigation interrupted by another one');
        }
        if (event.error)
          throw event.error;
      } else {
        event = await sameDocument.promise;
      }

      if (!this._subtreeLifecycleEvents.has(waitUntil))
        await helper.waitForEvent(progress, this._eventEmitter, kAddLifecycleEvent, (e: types.LifecycleEvent) => e === waitUntil).promise;

      const request = event.newDocument ? event.newDocument.request : undefined;
      return request ? request._finalRequest().response() : null;
    });
  }

  async waitForNavigation(options: types.WaitForNavigationOptions = {}): Promise<network.Response | null> {
    return runNavigationTask(this, options, this._apiName('waitForNavigation'), async progress => {
      const toUrl = typeof options.url === 'string' ? ` to "${options.url}"` : '';
      const waitUntil = verifyLifecycle('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      progress.logger.info(`waiting for navigation${toUrl} until "${waitUntil}"`);

      const navigationEvent: NavigationEvent = await helper.waitForEvent(progress, this._eventEmitter, kNavigationEvent, (event: NavigationEvent) => {
        // Any failed navigation results in a rejection.
        if (event.error)
          return true;
        progress.logger.info(`  navigated to "${this._url}"`);
        return helper.urlMatches(this._url, options.url);
      }).promise;
      if (navigationEvent.error)
        throw navigationEvent.error;

      if (!this._subtreeLifecycleEvents.has(waitUntil))
        await helper.waitForEvent(progress, this._eventEmitter, kAddLifecycleEvent, (e: types.LifecycleEvent) => e === waitUntil).promise;

      const request = navigationEvent.newDocument ? navigationEvent.newDocument.request : undefined;
      return request ? request._finalRequest().response() : null;
    });
  }

  async waitForLoadState(state: types.LifecycleEvent = 'load', options: types.TimeoutOptions = {}): Promise<void> {
    return runNavigationTask(this, options, this._apiName('waitForLoadState'), progress => this._waitForLoadState(progress, state));
  }

  async _waitForLoadState(progress: Progress, state: types.LifecycleEvent): Promise<void> {
    const waitUntil = verifyLifecycle('state', state);
    if (!this._subtreeLifecycleEvents.has(waitUntil))
      await helper.waitForEvent(progress, this._eventEmitter, kAddLifecycleEvent, (e: types.LifecycleEvent) => e === waitUntil).promise;
  }

  async frameElement(): Promise<dom.ElementHandle> {
    return this._page._delegate.getFrameElement(this);
  }

  _context(world: types.World): Promise<dom.FrameExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._contextData.get(world)!.contextPromise;
  }

  _mainContext(): Promise<dom.FrameExecutionContext> {
    return this._context('main');
  }

  _utilityContext(): Promise<dom.FrameExecutionContext> {
    return this._context('utility');
  }

  async evaluateHandle<R, Arg>(pageFunction: js.Func1<Arg, R>, arg: Arg): Promise<js.SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: js.Func1<void, R>, arg?: any): Promise<js.SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: js.Func1<Arg, R>, arg: Arg): Promise<js.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    const context = await this._mainContext();
    return context.evaluateHandleInternal(pageFunction, arg);
  }

  async _evaluateExpressionHandle(expression: string, isFunction: boolean, arg: any): Promise<any> {
    const context = await this._mainContext();
    return context.evaluateExpressionHandleInternal(expression, isFunction, arg);
  }

  async evaluate<R, Arg>(pageFunction: js.Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: js.Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: js.Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const context = await this._mainContext();
    return context.evaluateInternal(pageFunction, arg);
  }

  async _evaluateExpression(expression: string, isFunction: boolean, arg: any): Promise<any> {
    const context = await this._mainContext();
    return context.evaluateExpressionInternal(expression, isFunction, arg);
  }

  async $(selector: string): Promise<dom.ElementHandle<Element> | null> {
    return selectors._query(this, selector);
  }

  async waitForSelector(selector: string, options: types.WaitForElementOptions = {}): Promise<dom.ElementHandle<Element> | null> {
    if ((options as any).visibility)
      throw new Error('options.visibility is not supported, did you mean options.state?');
    if ((options as any).waitFor && (options as any).waitFor !== 'visible')
      throw new Error('options.waitFor is not supported, did you mean options.state?');
    const { state = 'visible' } = options;
    if (!['attached', 'detached', 'visible', 'hidden'].includes(state))
      throw new Error(`state: expected one of (attached|detached|visible|hidden)`);
    const info = selectors._parseSelector(selector);
    const task = dom.waitForSelectorTask(info, state);
    return this._page._runAbortableTask(async progress => {
      progress.logger.info(`waiting for selector "${selector}"${state === 'attached' ? '' : ' to be ' + state}`);
      const result = await this._scheduleRerunnableHandleTask(progress, info.world, task);
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
    }, this._page._timeoutSettings.timeout(options), this._apiName('waitForSelector'));
  }

  async dispatchEvent(selector: string, type: string, eventInit?: Object, options: types.TimeoutOptions = {}): Promise<void> {
    const info = selectors._parseSelector(selector);
    const task = dom.dispatchEventTask(info, type, eventInit || {});
    return this._page._runAbortableTask(async progress => {
      progress.logger.info(`Dispatching "${type}" event on selector "${selector}"...`);
      // Note: we always dispatch events in the main world.
      await this._scheduleRerunnableTask(progress, 'main', task);
    }, this._page._timeoutSettings.timeout(options), this._apiName('dispatchEvent'));
  }

  async $eval<R, Arg>(selector: string, pageFunction: js.FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: js.FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: js.FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return this._$evalExpression(selector, String(pageFunction), typeof pageFunction === 'function', arg);
  }

  async _$evalExpression(selector: string, expression: string, isFunction: boolean, arg: any): Promise<any> {
    const handle = await this.$(selector);
    if (!handle)
      throw new Error(`Error: failed to find element matching selector "${selector}"`);
    const result = await handle._evaluateExpression(expression, isFunction, true, arg);
    handle.dispose();
    return result;
  }

  async $$eval<R, Arg>(selector: string, pageFunction: js.FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: js.FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: js.FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return this._$$evalExpression(selector, String(pageFunction), typeof pageFunction === 'function', arg);
  }

  async _$$evalExpression(selector: string, expression: string, isFunction: boolean, arg: any): Promise<any> {
    const arrayHandle = await selectors._queryArray(this, selector);
    const result = await arrayHandle._evaluateExpression(expression, isFunction, true, arg);
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

  async setContent(html: string, options: types.NavigateOptions = {}): Promise<void> {
    return runNavigationTask(this, options, this._apiName('setContent'), async progress => {
      const waitUntil = options.waitUntil === undefined ? 'load' : options.waitUntil;
      progress.logger.info(`setting frame content, waiting until "${waitUntil}"`);
      const tag = `--playwright--set--content--${this._id}--${++this._setContentCounter}--`;
      const context = await this._utilityContext();
      const lifecyclePromise = new Promise((resolve, reject) => {
        this._page._frameManager._consoleMessageTags.set(tag, () => {
          // Clear lifecycle right after document.open() - see 'tag' below.
          this._onClearLifecycle();
          this._waitForLoadState(progress, waitUntil).then(resolve).catch(reject);
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
    });
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
        contents += '\n//# sourceURL=' + path.replace(/\n/g, '');
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
        contents += '\n/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
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
    action: (progress: Progress, handle: dom.ElementHandle<Element>) => Promise<R | 'error:notconnected'>,
    apiName: string): Promise<R> {
    const info = selectors._parseSelector(selector);
    return this._page._runAbortableTask(async progress => {
      while (progress.isRunning()) {
        progress.logger.info(`waiting for selector "${selector}"`);
        const task = dom.waitForSelectorTask(info, 'attached');
        const handle = await this._scheduleRerunnableHandleTask(progress, info.world, task);
        const element = handle.asElement() as dom.ElementHandle<Element>;
        progress.cleanupWhenAborted(() => {
          // Do not await here to avoid being blocked, either by stalled
          // page (e.g. alert) or unresolved navigation in Chromium.
          element.dispose();
        });
        const result = await action(progress, element);
        element.dispose();
        if (result === 'error:notconnected') {
          progress.logger.info('element was detached from the DOM, retrying');
          continue;
        }
        return result;
      }
      return undefined as any;
    }, this._page._timeoutSettings.timeout(options), apiName);
  }

  async click(selector: string, options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._click(progress, options), this._apiName('click'));
  }

  async dblclick(selector: string, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._dblclick(progress, options), this._apiName('dblclick'));
  }

  async fill(selector: string, value: string, options: types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._fill(progress, value, options), this._apiName('fill'));
  }

  async focus(selector: string, options: types.TimeoutOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._focus(progress), this._apiName('focus'));
  }

  async textContent(selector: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    const info = selectors._parseSelector(selector);
    const task = dom.textContentTask(info);
    return this._page._runAbortableTask(async progress => {
      progress.logger.info(`  retrieving textContent from "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options), this._apiName('textContent'));
  }

  async innerText(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    const info = selectors._parseSelector(selector);
    const task = dom.innerTextTask(info);
    return this._page._runAbortableTask(async progress => {
      progress.logger.info(`  retrieving innerText from "${selector}"`);
      const result = dom.throwFatalDOMError(await this._scheduleRerunnableTask(progress, info.world, task));
      return result.innerText;
    }, this._page._timeoutSettings.timeout(options), this._apiName('innerText'));
  }

  async innerHTML(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    const info = selectors._parseSelector(selector);
    const task = dom.innerHTMLTask(info);
    return this._page._runAbortableTask(async progress => {
      progress.logger.info(`  retrieving innerHTML from "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options), this._apiName('innerHTML'));
  }

  async getAttribute(selector: string, name: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    const info = selectors._parseSelector(selector);
    const task = dom.getAttributeTask(info, name);
    return this._page._runAbortableTask(async progress => {
      progress.logger.info(`  retrieving attribute "${name}" from "${selector}"`);
      return this._scheduleRerunnableTask(progress, info.world, task);
    }, this._page._timeoutSettings.timeout(options), this._apiName('getAttribute'));
  }

  async hover(selector: string, options: types.PointerActionOptions & types.PointerActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._hover(progress, options), this._apiName('hover'));
  }

  async selectOption(selector: string, values: string | dom.ElementHandle | types.SelectOption | string[] | dom.ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._selectOption(progress, values, options), this._apiName('selectOption'));
  }

  async setInputFiles(selector: string, files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._setInputFiles(progress, files, options), this._apiName('setInputFiles'));
  }

  async type(selector: string, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._type(progress, text, options), this._apiName('type'));
  }

  async press(selector: string, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._press(progress, key, options), this._apiName('press'));
  }

  async check(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._setChecked(progress, true, options), this._apiName('check'));
  }

  async uncheck(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._retryWithSelectorIfNotConnected(selector, options, (progress, handle) => handle._setChecked(progress, false, options), this._apiName('uncheck'));
  }

  async waitForTimeout(timeout: number) {
    await new Promise(fulfill => setTimeout(fulfill, timeout));
  }

  async waitForFunction<R, Arg>(pageFunction: js.Func1<Arg, R>, arg: Arg, options?: types.WaitForFunctionOptions): Promise<js.SmartHandle<R>>;
  async waitForFunction<R>(pageFunction: js.Func1<void, R>, arg?: any, options?: types.WaitForFunctionOptions): Promise<js.SmartHandle<R>>;
  async waitForFunction<R, Arg>(pageFunction: js.Func1<Arg, R>, arg: Arg, options: types.WaitForFunctionOptions = {}): Promise<js.SmartHandle<R>> {
    return this._waitForFunctionExpression(String(pageFunction), typeof pageFunction === 'function', arg, options);
  }

  async _waitForFunctionExpression<R>(expression: string, isFunction: boolean, arg: any, options: types.WaitForFunctionOptions = {}): Promise<js.SmartHandle<R>> {
    const { polling = 'raf' } = options;
    if (helper.isString(polling))
      assert(polling === 'raf', 'Unknown polling option: ' + polling);
    else if (helper.isNumber(polling))
      assert(polling > 0, 'Cannot poll with non-positive interval: ' + polling);
    else
      throw new Error('Unknown polling option: ' + polling);
    const predicateBody = isFunction ? 'return (' + expression + ')(arg)' :  'return (' + expression + ')';
    const task: dom.SchedulableTask<R> = injectedScript => injectedScript.evaluateHandle((injectedScript, { predicateBody, polling, arg }) => {
      const innerPredicate = new Function('arg', predicateBody) as (arg: any) => R;
      if (polling === 'raf')
        return injectedScript.pollRaf((progress, continuePolling) => innerPredicate(arg) || continuePolling);
      return injectedScript.pollInterval(polling, (progress, continuePolling) => innerPredicate(arg) || continuePolling);
    }, { predicateBody, polling, arg });
    return this._page._runAbortableTask(
        progress => this._scheduleRerunnableHandleTask(progress, 'main', task),
        this._page._timeoutSettings.timeout(options), this._apiName('waitForFunction'));
  }

  async title(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluateInternal(() => document.title);
  }

  _onDetached() {
    this._stopNetworkIdleTimer();
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

  private _scheduleRerunnableTask<T>(progress: Progress, world: types.World, task: dom.SchedulableTask<T>): Promise<T> {
    const data = this._contextData.get(world)!;
    const rerunnableTask = new RerunnableTask(data, progress, task, true /* returnByValue */);
    if (this._detached)
      rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    if (data.context)
      rerunnableTask.rerun(data.context);
    return rerunnableTask.promise;
  }

  private _scheduleRerunnableHandleTask<T>(progress: Progress, world: types.World, task: dom.SchedulableTask<T>): Promise<js.SmartHandle<T>> {
    const data = this._contextData.get(world)!;
    const rerunnableTask = new RerunnableTask(data, progress, task, false /* returnByValue */);
    if (this._detached)
      rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    if (data.context)
      rerunnableTask.rerun(data.context);
    return rerunnableTask.promise;
  }

  private _setContext(world: types.World, context: dom.FrameExecutionContext | null) {
    const data = this._contextData.get(world)!;
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

  _contextCreated(world: types.World, context: dom.FrameExecutionContext) {
    const data = this._contextData.get(world)!;
    // In case of multiple sessions to the same target, there's a race between
    // connections so we might end up creating multiple isolated worlds.
    // We can use either.
    if (data.context)
      this._setContext(world, null);
    this._setContext(world, context);
  }

  _contextDestroyed(context: dom.FrameExecutionContext) {
    for (const [world, data] of this._contextData) {
      if (data.context === context)
        this._setContext(world, null);
    }
  }

  _startNetworkIdleTimer() {
    assert(!this._networkIdleTimer);
    if (this._firedLifecycleEvents.has('networkidle'))
      return;
    this._networkIdleTimer = setTimeout(() => this._onLifecycleEvent('networkidle'), 500);
  }

  _stopNetworkIdleTimer() {
    if (this._networkIdleTimer)
      clearTimeout(this._networkIdleTimer);
    this._networkIdleTimer = undefined;
  }
}

class RerunnableTask {
  readonly promise: Promise<any>;
  private _task: dom.SchedulableTask<any>;
  private _resolve: (result: any) => void = () => {};
  private _reject: (reason: Error) => void = () => {};
  private _progress: Progress;
  private _returnByValue: boolean;

  constructor(data: ContextData, progress: Progress, task: dom.SchedulableTask<any>, returnByValue: boolean) {
    this._task = task;
    this._progress = progress;
    this._returnByValue = returnByValue;
    data.rerunnableTasks.add(this);
    this.promise = new Promise<any>((resolve, reject) => {
      // The task is either resolved with a value, or rejected with a meaningful evaluation error.
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  terminate(error: Error) {
    this._reject(error);
  }

  async rerun(context: dom.FrameExecutionContext) {
    try {
      const injectedScript = await context.injectedScript();
      const pollHandler = new dom.InjectedScriptPollHandler(this._progress, await this._task(injectedScript));
      const result = this._returnByValue ? await pollHandler.finish() : await pollHandler.finishHandle();
      this._resolve(result);
    } catch (e) {
      // When the page is navigated, the promise is rejected.
      // We will try again in the new execution context.
      if (e.message.includes('Execution context was destroyed'))
        return;

      // We could have tried to evaluate in a context which was already
      // destroyed.
      if (e.message.includes('Cannot find context with specified id'))
        return;

      this._reject(e);
    }
  }
}

class SignalBarrier {
  private _progress: Progress | null;
  private _protectCount = 0;
  private _promise: Promise<void>;
  private _promiseCallback = () => {};

  constructor(progress: Progress | null) {
    this._progress = progress;
    this._promise = new Promise(f => this._promiseCallback = f);
    this.retain();
  }

  waitFor(): Promise<void> {
    this.release();
    return this._promise;
  }

  async addFrameNavigation(frame: Frame) {
    this.retain();
    const waiter = helper.waitForEvent(null, frame._eventEmitter, kNavigationEvent, (e: NavigationEvent) => {
      if (!e.error && this._progress)
        this._progress.logger.info(`  navigated to "${frame._url}"`);
      return true;
    });
    await Promise.race([
      frame._page._disconnectedPromise,
      frame._page._crashedPromise,
      frame._detachedPromise,
      waiter.promise,
    ]).catch(e => {});
    waiter.dispose();
    this.release();
  }

  retain() {
    ++this._protectCount;
  }

  release() {
    --this._protectCount;
    if (!this._protectCount)
      this._promiseCallback();
  }
}

async function runNavigationTask<T>(frame: Frame, options: types.TimeoutOptions, apiName: string, task: (progress: Progress) => Promise<T>): Promise<T> {
  const page = frame._page;
  const controller = new ProgressController(page._logger, page._timeoutSettings.navigationTimeout(options), apiName);
  page._disconnectedPromise.then(() => controller.abort(new Error('Navigation failed because page was closed!')));
  page._crashedPromise.then(() => controller.abort(new Error('Navigation failed because page crashed!')));
  frame._detachedPromise.then(() => controller.abort(new Error('Navigating frame was detached!')));
  return controller.run(task);
}

function verifyLifecycle(name: string, waitUntil: types.LifecycleEvent): types.LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!types.kLifecycleEvents.has(waitUntil))
    throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle)`);
  return waitUntil;
}
