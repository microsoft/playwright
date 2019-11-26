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

import * as EventEmitter from 'events';
import * as fs from 'fs';
import * as types from '../types';
import { TimeoutError } from '../Errors';
import { Events } from './events';
import { assert, debugError, helper, RegisteredListener } from '../helper';
import { TimeoutSettings } from '../TimeoutSettings';
import { TargetSession } from './Connection';
import { ExecutionContext } from './ExecutionContext';
import { ElementHandle, JSHandle } from './JSHandle';
import { NetworkManager, NetworkManagerEvents, Request, Response } from './NetworkManager';
import { Page } from './Page';
import { Protocol } from './protocol';
import { MultiClickOptions, ClickOptions, SelectOption } from '../input';
import { WaitTask, WaitTaskParams } from '../waitTask';

const readFileAsync = helper.promisify(fs.readFile);

export const FrameManagerEvents = {
  FrameNavigatedWithinDocument: Symbol('FrameNavigatedWithinDocument'),
  TargetSwappedOnNavigation: Symbol('TargetSwappedOnNavigation'),
  FrameAttached: Symbol('FrameAttached'),
  FrameDetached: Symbol('FrameDetached'),
  FrameNavigated: Symbol('FrameNavigated'),
};

export class FrameManager extends EventEmitter {
  _session: TargetSession;
  _page: Page;
  _networkManager: NetworkManager;
  _timeoutSettings: TimeoutSettings;
  _frames: Map<string, Frame>;
  _contextIdToContext: Map<number, ExecutionContext>;
  _isolatedWorlds: Set<string>;
  _sessionListeners: RegisteredListener[];
  _mainFrame: Frame;

  constructor(session: TargetSession, page: Page, timeoutSettings: TimeoutSettings) {
    super();
    this._session = session;
    this._page = page;
    this._networkManager = new NetworkManager(session, this);
    this._timeoutSettings = timeoutSettings;
    this._frames = new Map();
    this._contextIdToContext = new Map();
    this._isolatedWorlds = new Set();

    this._addSessionListeners();
  }

  async initialize() {
    const [,{frameTree}] = await Promise.all([
      // Page agent must be enabled before Runtime.
      this._session.send('Page.enable'),
      this._session.send('Page.getResourceTree'),
    ]);
    this._handleFrameTree(frameTree);
    await Promise.all([
      this._session.send('Runtime.enable'),
      this._networkManager.initialize(),
    ]);
  }

  _addSessionListeners() {
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Page.frameNavigated', event => this._onFrameNavigated(event.frame)),
      helper.addEventListener(this._session, 'Page.navigatedWithinDocument', event => this._onFrameNavigatedWithinDocument(event.frameId, event.url)),
      helper.addEventListener(this._session, 'Page.frameDetached', event => this._onFrameDetached(event.frameId)),
      helper.addEventListener(this._session, 'Page.frameStoppedLoading', event => this._onFrameStoppedLoading(event.frameId)),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', event => this._onExecutionContextCreated(event.context)),
    ];
  }

  async _swapTargetOnNavigation(newSession) {
    helper.removeEventListeners(this._sessionListeners);
    this.disconnectFromTarget();
    this._session = newSession;
    this._addSessionListeners();
    this._networkManager.setSession(newSession);
    this.emit(FrameManagerEvents.TargetSwappedOnNavigation);
    // this.initialize() will be called by page.
  }

  disconnectFromTarget() {
    for (const frame of this.frames())
      frame._setContext(null);
    // this._mainFrame = null;
  }

  networkManager(): NetworkManager {
    return this._networkManager;
  }

  _onFrameStoppedLoading(frameId: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._onLoadingStopped();
  }

  _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    if (frameTree.frame.parentId)
      this._onFrameAttached(frameTree.frame.id, frameTree.frame.parentId);
    this._onFrameNavigated(frameTree.frame);
    if (!frameTree.childFrames)
      return;

    for (const child of frameTree.childFrames)
      this._handleFrameTree(child);
  }

  page(): Page {
    return this._page;
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frames(): Array<Frame> {
    return Array.from(this._frames.values());
  }

  frame(frameId: string): Frame | null {
    return this._frames.get(frameId) || null;
  }

  _onFrameAttached(frameId: string, parentFrameId: string | null) {
    if (this._frames.has(frameId))
      return;
    assert(parentFrameId);
    const parentFrame = this._frames.get(parentFrameId);
    const frame = new Frame(this, this._session, parentFrame, frameId);
    this._frames.set(frame._id, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
    return frame;
  }

  _onFrameNavigated(framePayload: Protocol.Page.Frame) {
    const isMainFrame = !framePayload.parentId;
    let frame = isMainFrame ? this._mainFrame : this._frames.get(framePayload.id);

    // Detach all child frames first.
    if (frame) {
      for (const child of frame.childFrames())
        this._removeFramesRecursively(child);
      if (isMainFrame) {
        // Update frame id to retain frame identity on cross-process navigation.
        this._frames.delete(frame._id);
        frame._id = framePayload.id;
        this._frames.set(framePayload.id, frame);
      }
    } else if (isMainFrame) {
      // Initial frame navigation.
      frame = new Frame(this, this._session, null, framePayload.id);
      this._frames.set(framePayload.id, frame);
    } else {
      // FIXME(WebKit): there is no Page.frameAttached event in WK.
      frame = this._onFrameAttached(framePayload.id, framePayload.parentId);
    }
    // Update or create main frame.
    if (isMainFrame)
      this._mainFrame = frame;

    // Update frame payload.
    frame._navigated(framePayload);

    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  _onFrameNavigatedWithinDocument(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._navigatedWithinDocument(url);
    this.emit(FrameManagerEvents.FrameNavigatedWithinDocument, frame);
    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  _onFrameDetached(frameId: string) {
    const frame = this._frames.get(frameId);
    if (frame)
      this._removeFramesRecursively(frame);
  }

  _onExecutionContextCreated(contextPayload : Protocol.Runtime.ExecutionContextDescription) {
    if (!contextPayload.isPageContext)
      return;
    const frameId = contextPayload.frameId;
    // If the frame was attached manually there is no navigation event.
    // FIXME: support frameAttached event in WebKit protocol.
    const frame = this._frames.get(frameId) || null;
    if (!frame)
      return;
    // FIXME(WebKit): we ignore duplicate Runtime.executionContextCreated events here.
    if (frame._executionContext && frame._executionContext._contextId === contextPayload.id)
      return;
    /** @type {!ExecutionContext} */
    const context: ExecutionContext = new ExecutionContext(this._session, contextPayload, frame);
    frame._setContext(context);
    this._contextIdToContext.set(contextPayload.id, context);
  }

  executionContextById(contextId: number): ExecutionContext {
    const context = this._contextIdToContext.get(contextId);
    assert(context, 'INTERNAL ERROR: missing context with id = ' + contextId);
    return context;
  }

  _removeFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._detach();
    this._frames.delete(frame._id);
    this.emit(FrameManagerEvents.FrameDetached, frame);
  }
}

export class Frame {
  _id: string;
  _frameManager: FrameManager;
  _session: any;
  _parentFrame: Frame;
  _url: string;
  _detached: boolean;
  _loaderId: string;
  _lifecycleEvents: Set<string>;
  _waitTasks: Set<WaitTask<JSHandle>>;
  _executionContext: ExecutionContext | null;
  _contextPromise: Promise<ExecutionContext>;
  _contextResolveCallback: (arg: ExecutionContext) => void;
  _childFrames: Set<Frame>;
  _documentPromise: Promise<ElementHandle>;
  _name: string;
  _navigationURL: any;
  constructor(frameManager: FrameManager, client: TargetSession, parentFrame: Frame | null, frameId: string) {
    this._frameManager = frameManager;
    this._session = client;
    this._parentFrame = parentFrame;
    this._url = '';
    this._id = frameId;
    this._detached = false;

    this._loaderId = '';
    /** @type {!Set<string>} */
    this._lifecycleEvents = new Set();

    /** @type {!Set<!WaitTask>} */
    this._waitTasks = new Set();

    this._executionContext = null;
    this._contextPromise = null;
    this._contextResolveCallback = null;
    this._setContext(null);

    /** @type {!Set<!Frame>} */
    this._childFrames = new Set();
    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  async goto(url: string, options: { referer?: string; timeout?: number; waitUntil?: string | Array<string>; } | undefined = {}): Promise<Response | null> {
    const {
      timeout = this._frameManager._timeoutSettings.navigationTimeout(),
    } = options;
    const watchDog = new NextNavigationWatchdog(this, timeout);
    await this._session.send('Page.navigate', {url});
    return watchDog.waitForNavigation();
  }

  async waitForNavigation(): Promise<Response | null> {
    // FIXME: this method only works for main frames.
    const watchDog = new NextNavigationWatchdog(this, 10000);
    return watchDog.waitForNavigation();
  }

  waitForSelector(selector: string, options: { visible?: boolean; hidden?: boolean; timeout?: number; } | undefined): Promise<ElementHandle | null> {
    return this._waitForSelectorOrXPath(selector, false, options);
  }

  waitForXPath(xpath: string, options: { visible?: boolean; hidden?: boolean; timeout?: number; } | undefined): Promise<ElementHandle | null> {
    return this._waitForSelectorOrXPath(xpath, true, options);
  }

  waitForFunction(pageFunction: Function | string, options: { polling?: string | number; timeout?: number; } | undefined = {}, ...args): Promise<JSHandle> {
    const {
      polling = 'raf',
      timeout = this._frameManager._timeoutSettings.timeout(),
    } = options;
    const params: WaitTaskParams = {
      predicateBody: pageFunction,
      title: 'function',
      polling,
      timeout,
      args
    };
    return this._scheduleWaitTask(params);
  }

  async executionContext(): Promise<ExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame`);
    return this._contextPromise;
  }

  evaluateHandle: types.EvaluateHandle<JSHandle> = async (pageFunction, ...args) => {
    const context = await this.executionContext();
    return context.evaluateHandle(pageFunction, ...args as any);
  }

  evaluate: types.Evaluate<JSHandle> = async (pageFunction, ...args) => {
    const context = await this.executionContext();
    return context.evaluate(pageFunction, ...args as any);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    const document = await this._document();
    const value = await document.$(selector);
    return value;
  }

  _document(): Promise<ElementHandle> {
    if (!this._documentPromise) {
      this._documentPromise = this.executionContext().then(async context => {
        const document = await context.evaluateHandle('document');
        return document.asElement();
      });
    }
    return this._documentPromise;
  }

  async $x(expression: string): Promise<Array<ElementHandle>> {
    const document = await this._document();
    const value = await document.$x(expression);
    return value;
  }

  $eval: types.$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const document = await this._document();
    return document.$eval(selector, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const document = await this._document();
    const value = await document.$$eval(selector, pageFunction, ...args as any);
    return value;
  }

  async $$(selector: string): Promise<Array<ElementHandle>> {
    const document = await this._document();
    const value = await document.$$(selector);
    return value;
  }

  async content(): Promise<string> {
    return await this.evaluate(() => {
      let retVal = '';
      if (document.doctype)
        retVal = new XMLSerializer().serializeToString(document.doctype);
      if (document.documentElement)
        retVal += document.documentElement.outerHTML;
      return retVal;
    });
  }

  async setContent(html: string, options: { timeout?: number; waitUntil?: string | Array<string>; } | undefined = {}) {
    // We rely upon the fact that document.open() will trigger Page.loadEventFired.
    const watchDog = new NextNavigationWatchdog(this, 1000);
    await this.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    await watchDog.waitForNavigation();
  }

  async addScriptTag(options: { url?: string; path?: string; content?: string; type?: string; }): Promise<ElementHandle> {
    const {
      url = null,
      path = null,
      content = null,
      type = ''
    } = options;
    if (url !== null) {
      try {
        const context = await this.executionContext();
        return (await context.evaluateHandle(addScriptUrl, url, type)).asElement();
      } catch (error) {
        throw new Error(`Loading script from ${url} failed`);
      }
    }

    if (path !== null) {
      let contents = await readFileAsync(path, 'utf8');
      contents += '//# sourceURL=' + path.replace(/\n/g, '');
      const context = await this.executionContext();
      return (await context.evaluateHandle(addScriptContent, contents, type)).asElement();
    }

    if (content !== null) {
      const context = await this.executionContext();
      return (await context.evaluateHandle(addScriptContent, content, type)).asElement();
    }

    throw new Error('Provide an object with a `url`, `path` or `content` property');

    /**
     */
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

    /**
     */
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

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    const {
      url = null,
      path = null,
      content = null
    } = options;
    if (url !== null) {
      try {
        const context = await this.executionContext();
        return (await context.evaluateHandle(addStyleUrl, url)).asElement();
      } catch (error) {
        throw new Error(`Loading style from ${url} failed`);
      }
    }

    if (path !== null) {
      let contents = await readFileAsync(path, 'utf8');
      contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
      const context = await this.executionContext();
      return (await context.evaluateHandle(addStyleContent, contents)).asElement();
    }

    if (content !== null) {
      const context = await this.executionContext();
      return (await context.evaluateHandle(addStyleContent, content)).asElement();
    }

    throw new Error('Provide an object with a `url`, `path` or `content` property');

    /**
     */
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

    /**
     */
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

  name(): string {
    return this._name || '';
  }

  url(): string {
    return this._url;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Array<Frame> {
    return Array.from(this._childFrames);
  }

  isDetached(): boolean {
    return this._detached;
  }

  async click(selector: string, options?: ClickOptions) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.click(options);
    await handle.dispose();
  }

  async dblclick(selector: string, options?: MultiClickOptions) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.dblclick(options);
    await handle.dispose();
  }

  async tripleclick(selector: string, options?: MultiClickOptions) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.tripleclick(options);
    await handle.dispose();
  }

  async fill(selector: string, value: string) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.fill(value);
    await handle.dispose();
  }

  async focus(selector: string) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.focus();
    await handle.dispose();
  }

  async hover(selector: string) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.hover();
    await handle.dispose();
  }

  async select(selector: string, ...values: (string | ElementHandle | SelectOption)[]): Promise<string[]> {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    const result = await handle.select(...values);
    await handle.dispose();
    return result;
  }

  async type(selector: string, text: string, options: { delay: (number | undefined); } | undefined) {
    const handle = await this.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.type(text, options);
    await handle.dispose();
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: object | undefined = {}, ...args: Array<any>): Promise<JSHandle | null> {
    const xPathPattern = '//';

    if (helper.isString(selectorOrFunctionOrTimeout)) {
      const string: string = /** @type {string} */ (selectorOrFunctionOrTimeout);
      if (string.startsWith(xPathPattern))
        return this.waitForXPath(string, options);
      return this.waitForSelector(string, options);
    }
    if (helper.isNumber(selectorOrFunctionOrTimeout))
      return new Promise(fulfill => setTimeout(fulfill, /** @type {number} */ (selectorOrFunctionOrTimeout)));
    if (typeof selectorOrFunctionOrTimeout === 'function')
      return this.waitForFunction(selectorOrFunctionOrTimeout, options, ...args);
    return Promise.reject(new Error('Unsupported target type: ' + (typeof selectorOrFunctionOrTimeout)));
  }

  async title(): Promise<string> {
    return this.evaluate(() => document.title);
  }

  async _waitForSelectorOrXPath(selectorOrXPath: string, isXPath: boolean, options: { visible?: boolean; hidden?: boolean; timeout?: number; } | undefined = {}): Promise<ElementHandle | null> {
    const {
      visible: waitForVisible = false,
      hidden: waitForHidden = false,
      timeout = this._frameManager._timeoutSettings.timeout(),
    } = options;
    const polling = waitForVisible || waitForHidden ? 'raf' : 'mutation';
    const title = `${isXPath ? 'XPath' : 'selector'} "${selectorOrXPath}"${waitForHidden ? ' to be hidden' : ''}`;
    const params: WaitTaskParams = {
      predicateBody: predicate,
      title,
      polling,
      timeout,
      args: [selectorOrXPath, isXPath, waitForVisible, waitForHidden]
    };
    const handle = await this._scheduleWaitTask(params);
    if (!handle.asElement()) {
      await handle.dispose();
      return null;
    }
    return handle.asElement();

    /**
     */
    function predicate(selectorOrXPath: string, isXPath: boolean, waitForVisible: boolean, waitForHidden: boolean): (Node | boolean) | null {
      const node = isXPath
        ? document.evaluate(selectorOrXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        : document.querySelector(selectorOrXPath);
      if (!node)
        return waitForHidden;
      if (!waitForVisible && !waitForHidden)
        return node;
      const element: Element = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as Element;

      const style = window.getComputedStyle(element);
      const isVisible = style && style.visibility !== 'hidden' && hasVisibleBoundingBox();
      const success = (waitForVisible === isVisible || waitForHidden === !isVisible);
      return success ? node : null;

      /**
       */
      function hasVisibleBoundingBox(): boolean {
        const rect = element.getBoundingClientRect();
        return !!(rect.top || rect.bottom || rect.width || rect.height);
      }
    }
  }

  _navigated(framePayload: Protocol.Page.Frame) {
    this._name = framePayload.name;
    // TODO(lushnikov): remove this once requestInterception has loaderId exposed.
    this._navigationURL = framePayload.url;
    this._url = framePayload.url;
    // It may have been disposed by targetDestroyed.
    if (this._executionContext)
      this._setContext(null);
  }

  _navigatedWithinDocument(url: string) {
    this._url = url;
  }

  _onLoadingStopped() {
    this._lifecycleEvents.add('DOMContentLoaded');
    this._lifecycleEvents.add('load');
  }

  _detach() {
    this._detached = true;
    for (const waitTask of this._waitTasks)
      waitTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    if (this._parentFrame)
      this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  _setContext(context: ExecutionContext | null) {
    if (this._executionContext)
      this._executionContext._dispose();
    this._executionContext = context;
    if (context) {
      this._contextResolveCallback.call(null, context);
      this._contextResolveCallback = null;
      for (const waitTask of this._waitTasks)
        waitTask.rerun(context);
    } else {
      this._documentPromise = null;
      this._contextPromise = new Promise(fulfill => {
        this._contextResolveCallback = fulfill;
      });
    }
  }

  private _scheduleWaitTask(params: WaitTaskParams): Promise<JSHandle> {
    const task = new WaitTask(params, () => this._waitTasks.delete(task));
    this._waitTasks.add(task);
    if (this._executionContext)
      task.rerun(this._executionContext);
    return task.promise;
  }
}

/**
 * @internal
 */
class NextNavigationWatchdog {
  _frame: any;
  _newDocumentNavigationPromise: Promise<unknown>;
  _newDocumentNavigationCallback: (value?: unknown) => void;
  _sameDocumentNavigationPromise: Promise<unknown>;
  _sameDocumentNavigationCallback: (value?: unknown) => void;
  _navigationRequest: any;
  _eventListeners: RegisteredListener[];
  _timeoutPromise: Promise<unknown>;
  _timeoutId: NodeJS.Timer;

  constructor(frame, timeout) {
    this._frame = frame;
    this._newDocumentNavigationPromise = new Promise(fulfill => {
      this._newDocumentNavigationCallback = fulfill;
    });
    this._sameDocumentNavigationPromise = new Promise(fulfill => {
      this._sameDocumentNavigationCallback = fulfill;
    });
    /** @type {?Request} */
    this._navigationRequest = null;
    this._eventListeners = [
      helper.addEventListener(frame._frameManager._page, Events.Page.Load, event => this._newDocumentNavigationCallback()),
      helper.addEventListener(frame._frameManager, FrameManagerEvents.FrameNavigatedWithinDocument, frame => this._onSameDocumentNavigation(frame)),
      helper.addEventListener(frame._frameManager, FrameManagerEvents.TargetSwappedOnNavigation, event => this._onTargetReconnected()),
      helper.addEventListener(frame._frameManager.networkManager(), NetworkManagerEvents.Request, this._onRequest.bind(this)),
    ];
    const timeoutError = new TimeoutError('Navigation Timeout Exceeded: ' + timeout + 'ms');
    let timeoutCallback;
    this._timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    this._timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;
  }

  async waitForNavigation() {
    const error = await Promise.race([
      this._timeoutPromise,
      this._newDocumentNavigationPromise,
      this._sameDocumentNavigationPromise
    ]);
    // TODO: handle exceptions
    this.dispose();
    if (error)
      throw error;
    return this.navigationResponse();
  }

  async _onTargetReconnected() {
    // In case web process change we migh have missed load event. Check current ready
    // state to mitigate that.
    try {
      const context = await this._frame.executionContext();
      const readyState = await context.evaluate(() => document.readyState);
      switch (readyState) {
        case 'loaded':
        case 'interactive':
        case 'complete':
          this._newDocumentNavigationCallback();
          break;
      }
    } catch (e) {
      debugError('_onTargetReconnected ' + e);
    }
  }

  _onSameDocumentNavigation(frame) {
    if (this._frame === frame)
      this._sameDocumentNavigationCallback();
  }

  _onRequest(request: Request) {
    if (request.frame() !== this._frame || !request.isNavigationRequest())
      return;
    this._navigationRequest = request;
  }

  navigationResponse(): Response | null {
    return this._navigationRequest ? this._navigationRequest.response() : null;
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
    clearTimeout(this._timeoutId);
  }
}
