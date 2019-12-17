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
import * as fs from 'fs';
import * as js from './javascript';
import * as dom from './dom';
import * as network from './network';
import { helper, assert, RegisteredListener } from './helper';
import { ClickOptions, MultiClickOptions, PointerActionOptions, SelectOption } from './input';
import { TimeoutError } from './errors';
import { Events } from './events';
import { Page } from './page';
import { ConsoleMessage } from './console';

const readFileAsync = helper.promisify(fs.readFile);

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

export type GotoOptions = NavigateOptions & {
  referer?: string,
};
export type GotoResult = {
  newDocumentId?: string,
  isSameDocument?: boolean,
};

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']);

export type WaitForOptions = types.TimeoutOptions & { waitFor?: boolean | 'visible' | 'hidden' | 'any' };

export class FrameManager {
  private _page: Page;
  private _frames = new Map<string, Frame>();
  private _mainFrame: Frame;
  readonly _lifecycleWatchers = new Set<LifecycleWatcher>();

  constructor(page: Page) {
    this._page = page;
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
    const parentFrame = parentFrameId ? this._frames.get(parentFrameId) : null;
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
    const frame = this._frames.get(frameId);
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._url = url;
    frame._name = name;
    frame._lastDocumentId = documentId;
    frame._firedLifecycleEvents.clear();
    if (!initial) {
      for (const watcher of this._lifecycleWatchers)
        watcher._onCommittedNewDocumentNavigation(frame);
    }
    this._stopNetworkIdleTimer(frame, 'networkidle0');
    if (frame._inflightRequests === 0)
      this._startNetworkIdleTimer(frame, 'networkidle0');
    this._stopNetworkIdleTimer(frame, 'networkidle2');
    if (frame._inflightRequests <= 2)
      this._startNetworkIdleTimer(frame, 'networkidle2');
    this._page.emit(Events.Page.FrameNavigated, frame);
  }

  frameCommittedSameDocumentNavigation(frameId: string, url: string) {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    frame._url = url;
    for (const watcher of this._lifecycleWatchers)
      watcher._onNavigatedWithinDocument(frame);
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
      watcher._onLifecycleEvent(frame);
    if (frame === this.mainFrame() && !hasDOMContentLoaded)
      this._page.emit(Events.Page.DOMContentLoaded);
    if (frame === this.mainFrame() && !hasLoad)
      this._page.emit(Events.Page.Load);
  }

  frameLifecycleEvent(frameId: string, event: LifecycleEvent | 'clear') {
    const frame = this._frames.get(frameId);
    if (!frame)
      return;
    if (event === 'clear') {
      frame._firedLifecycleEvents.clear();
    } else {
      frame._firedLifecycleEvents.add(event);
      for (const watcher of this._lifecycleWatchers)
        watcher._onLifecycleEvent(frame);
    }
    if (frame === this._mainFrame && event === 'load')
      this._page.emit(Events.Page.Load);
    if (frame === this._mainFrame && event === 'domcontentloaded')
      this._page.emit(Events.Page.DOMContentLoaded);
  }

  requestStarted(request: network.Request) {
    if (request.frame())
      this._incrementRequestCount(request.frame());
    if (request._documentId && request.frame() && !request.redirectChain().length) {
      for (const watcher of this._lifecycleWatchers)
        watcher._onNavigationRequest(request.frame(), request);
    }
    this._page.emit(Events.Page.Request, request);
  }

  requestReceivedResponse(response: network.Response) {
    this._page.emit(Events.Page.Response, response);
  }

  requestFinished(request: network.Request) {
    if (request.frame())
      this._decrementRequestCount(request.frame());
    this._page.emit(Events.Page.RequestFinished, request);
  }

  requestFailed(request: network.Request, canceled: boolean) {
    if (request.frame())
      this._decrementRequestCount(request.frame());
    if (request._documentId && request.frame()) {
      const isCurrentDocument = request.frame()._lastDocumentId === request._documentId;
      if (!isCurrentDocument) {
        let errorText = request.failure().errorText;
        if (canceled)
          errorText += '; maybe frame was detached?';
        for (const watcher of this._lifecycleWatchers)
          watcher._onAbortedNewDocumentNavigation(request.frame(), request._documentId, errorText);
      }
    }
    this._page.emit(Events.Page.RequestFailed, request);
  }

  private _removeFramesRecursively(frame: Frame) {
    for (const child of frame.childFrames())
      this._removeFramesRecursively(child);
    frame._onDetached();
    this._frames.delete(frame._id);
    for (const watcher of this._lifecycleWatchers)
      watcher._onFrameDetached(frame);
    this._page.emit(Events.Page.FrameDetached, frame);
  }

  private _decrementRequestCount(frame: Frame) {
    frame._inflightRequests--;
    if (frame._inflightRequests === 0)
      this._startNetworkIdleTimer(frame, 'networkidle0');
    if (frame._inflightRequests === 2)
      this._startNetworkIdleTimer(frame, 'networkidle2');
  }

  private _incrementRequestCount(frame: Frame) {
    frame._inflightRequests++;
    if (frame._inflightRequests === 1)
      this._stopNetworkIdleTimer(frame, 'networkidle0');
    if (frame._inflightRequests === 3)
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
    clearTimeout(frame._networkIdleTimers.get(event));
    frame._networkIdleTimers.delete(event);
  }
}

export class Frame {
  _id: string;
  readonly _firedLifecycleEvents: Set<LifecycleEvent>;
  _lastDocumentId: string;
  readonly _page: Page;
  private _parentFrame: Frame;
  _url = '';
  private _detached = false;
  private _contextData = new Map<ContextType, ContextData>();
  private _childFrames = new Set<Frame>();
  _name: string;
  _inflightRequests = 0;
  readonly _networkIdleTimers = new Map<LifecycleEvent, NodeJS.Timer>();

  constructor(page: Page, id: string, parentFrame: Frame | null) {
    this._id = id;
    this._firedLifecycleEvents = new Set();
    this._lastDocumentId = '';
    this._page = page;
    this._parentFrame = parentFrame;

    this._contextData.set('main', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._contextData.set('utility', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._setContext('main', null);
    this._setContext('utility', null);

    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  async goto(url: string, options: GotoOptions = {}): Promise<network.Response | null> {
    const {
      referer = (this._page._state.extraHTTPHeaders || {})['referer'],
      waitUntil = (['load'] as LifecycleEvent[]),
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;
    const watcher = new LifecycleWatcher(this, waitUntil, timeout);

    let navigateResult: GotoResult;
    const navigate = async () => {
      try {
        navigateResult = await this._page._delegate.navigateFrame(this, url, referer);
      } catch (error) {
        return error;
      }
    };

    let error = await Promise.race([
      navigate(),
      watcher.timeoutOrTerminationPromise,
    ]);
    if (!error) {
      const promises = [watcher.timeoutOrTerminationPromise];
      if (navigateResult.newDocumentId) {
        watcher.setExpectedDocumentId(navigateResult.newDocumentId, url);
        promises.push(watcher.newDocumentNavigationPromise);
      } else if (navigateResult.isSameDocument) {
        promises.push(watcher.sameDocumentNavigationPromise);
      } else {
        promises.push(watcher.sameDocumentNavigationPromise, watcher.newDocumentNavigationPromise);
      }
      error = await Promise.race(promises);
    }
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();
  }

  async waitForNavigation(options: NavigateOptions = {}): Promise<network.Response | null> {
    const {
      waitUntil = (['load'] as LifecycleEvent[]),
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;
    const watcher = new LifecycleWatcher(this, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.sameDocumentNavigationPromise,
      watcher.newDocumentNavigationPromise,
    ]);
    watcher.dispose();
    if (error)
      throw error;
    return watcher.navigationResponse();
  }

  _context(contextType: ContextType): Promise<dom.FrameExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._contextData.get(contextType).contextPromise;
  }

  _mainContext(): Promise<dom.FrameExecutionContext> {
    return this._context('main');
  }

  _utilityContext(): Promise<dom.FrameExecutionContext> {
    return this._context('utility');
  }

  executionContext(): Promise<dom.FrameExecutionContext> {
    return this._mainContext();
  }

  evaluateHandle: types.EvaluateHandle = async (pageFunction, ...args) => {
    const context = await this._mainContext();
    return context.evaluateHandle(pageFunction, ...args as any);
  }

  evaluate: types.Evaluate = async (pageFunction, ...args) => {
    const context = await this._mainContext();
    return context.evaluate(pageFunction, ...args as any);
  }

  async $(selector: string, options?: WaitForOptions): Promise<dom.ElementHandle<Element> | null> {
    return this._optionallyWaitForSelector('main', selector, options, true /* returnNull */);
  }

  async $x(expression: string): Promise<dom.ElementHandle<Element>[]> {
    const context = await this._mainContext();
    return context._$$('xpath=' + expression);
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

  async setContent(html: string, options: NavigateOptions = {}): Promise<void> {
    const {
      waitUntil = (['load'] as LifecycleEvent[]),
      timeout = this._page._timeoutSettings.navigationTimeout(),
    } = options;
    const context = await this._utilityContext();
    if (this._page._delegate.needsLifecycleResetOnSetContent())
      this._firedLifecycleEvents.clear();
    await context.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
    const watcher = new LifecycleWatcher(this, waitUntil, timeout);
    const error = await Promise.race([
      watcher.timeoutOrTerminationPromise,
      watcher.lifecyclePromise,
    ]);
    watcher.dispose();
    if (error)
      throw error;
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
        return (await context.evaluateHandle(addScriptUrl, url, type)).asElement();
      if (path !== null) {
        let contents = await readFileAsync(path, 'utf8');
        contents += '//# sourceURL=' + path.replace(/\n/g, '');
        return (await context.evaluateHandle(addScriptContent, contents, type)).asElement();
      }
      if (content !== null)
        return (await context.evaluateHandle(addScriptContent, content, type)).asElement();
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
        return (await context.evaluateHandle(addStyleUrl, url)).asElement();

      if (path !== null) {
        let contents = await readFileAsync(path, 'utf8');
        contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
        return (await context.evaluateHandle(addStyleContent, contents)).asElement();
      }

      if (content !== null)
        return (await context.evaluateHandle(addStyleContent, content)).asElement();
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
    let result: dom.ElementHandle | undefined;
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
    return result;
  }

  async click(selector: string, options?: WaitForOptions & ClickOptions) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.click(options);
    await handle.dispose();
  }

  async dblclick(selector: string, options?: WaitForOptions & MultiClickOptions) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.dblclick(options);
    await handle.dispose();
  }

  async tripleclick(selector: string, options?: WaitForOptions & MultiClickOptions) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.tripleclick(options);
    await handle.dispose();
  }

  async fill(selector: string, value: string, options?: WaitForOptions) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.fill(value);
    await handle.dispose();
  }

  async focus(selector: string, options?: WaitForOptions) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.focus();
    await handle.dispose();
  }

  async hover(selector: string, options?: WaitForOptions & PointerActionOptions) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.hover(options);
    await handle.dispose();
  }

  async select(selector: string, value: string | dom.ElementHandle | SelectOption | string[] | dom.ElementHandle[] | SelectOption[] | undefined, options?: WaitForOptions): Promise<string[]> {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    const toDispose: Promise<dom.ElementHandle>[] = [];
    const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
    const context = await this._utilityContext();
    const adoptedValues = await Promise.all(values.map(async value => {
      if (value instanceof dom.ElementHandle && value.executionContext() !== context) {
        const adopted = this._page._delegate.adoptElementHandle(value, context);
        toDispose.push(adopted);
        return adopted;
      }
      return value;
    }));
    const result = await handle.select(...adoptedValues);
    await handle.dispose();
    await Promise.all(toDispose.map(handlePromise => handlePromise.then(handle => handle.dispose())));
    return result;
  }

  async type(selector: string, text: string, options?: WaitForOptions & { delay?: number }) {
    const handle = await this._optionallyWaitForSelector('utility', selector, options);
    await handle.type(text, options);
    await handle.dispose();
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: any = {}, ...args: any[]): Promise<js.JSHandle | null> {
    if (helper.isString(selectorOrFunctionOrTimeout))
      return this.$(selectorOrFunctionOrTimeout as string, { waitFor: true, ...options }) as any;
    if (helper.isNumber(selectorOrFunctionOrTimeout))
      return new Promise(fulfill => setTimeout(fulfill, selectorOrFunctionOrTimeout as number));
    if (typeof selectorOrFunctionOrTimeout === 'function')
      return this.waitForFunction(selectorOrFunctionOrTimeout, options, ...args);
    return Promise.reject(new Error('Unsupported target type: ' + (typeof selectorOrFunctionOrTimeout)));
  }

  private async _optionallyWaitForSelector(contextType: ContextType, selector: string, options: WaitForOptions = {}, returnNull?: boolean): Promise<dom.ElementHandle<Element> | null> {
    const { timeout = this._page._timeoutSettings.timeout(), waitFor = undefined } = options;
    let handle: dom.ElementHandle<Element> | null;
    if (waitFor) {
      let visibility: types.Visibility = 'any';
      if (waitFor === 'visible' || waitFor === 'hidden' || waitFor === 'any')
        visibility = waitFor;
      else if (waitFor === true)
        visibility = 'any';
      else
        throw new Error(`Unsupported waitFor option "${waitFor}"`);
      const task = dom.waitForSelectorTask(selector, visibility, timeout);
      const result = await this._scheduleRerunnableTask(task, contextType, timeout, `selector "${selectorToString(selector, visibility)}"`);
      if (!result.asElement()) {
        await result.dispose();
        if (returnNull)
          return null;
        throw new Error('No node found for selector: ' + selectorToString(selector, visibility));
      }
      handle = result.asElement() as dom.ElementHandle<Element>;
    } else {
      const context = await this._context(contextType);
      handle = await context._$(selector);
      if (!returnNull)
        assert(handle, 'No node found for selector: ' + selector);
    }
    return handle;
  }

  waitForFunction(pageFunction: Function | string, options: types.WaitForFunctionOptions = {}, ...args: any[]): Promise<js.JSHandle> {
    options = { timeout: this._page._timeoutSettings.timeout(), ...options };
    const task = dom.waitForFunctionTask(pageFunction, options, ...args);
    return this._scheduleRerunnableTask(task, 'main', options.timeout);
  }

  async title(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluate(() => document.title);
  }

  _onDetached() {
    this._detached = true;
    for (const data of this._contextData.values()) {
      for (const rerunnableTask of data.rerunnableTasks)
        rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    }
    if (this._parentFrame)
      this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  private _scheduleRerunnableTask(task: dom.Task, contextType: ContextType, timeout?: number, title?: string): Promise<js.JSHandle> {
    const data = this._contextData.get(contextType);
    const rerunnableTask = new RerunnableTask(data, task, timeout, title);
    data.rerunnableTasks.add(rerunnableTask);
    if (data.context)
      rerunnableTask.rerun(data.context);
    return rerunnableTask.promise;
  }

  private _setContext(contextType: ContextType, context: dom.FrameExecutionContext | null) {
    const data = this._contextData.get(contextType);
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
    const data = this._contextData.get(contextType);
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
  private _resolve: (result: js.JSHandle) => void;
  private _reject: (reason: Error) => void;
  private _timeoutTimer: NodeJS.Timer;
  private _terminated: boolean;

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
      await success.dispose();
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
      this._resolve(success);

    this._doCleanup();
  }

  _doCleanup() {
    clearTimeout(this._timeoutTimer);
    this._contextData.rerunnableTasks.delete(this);
  }
}

class LifecycleWatcher {
  readonly sameDocumentNavigationPromise: Promise<Error | null>;
  readonly lifecyclePromise: Promise<void>;
  readonly newDocumentNavigationPromise: Promise<Error | null>;
  readonly timeoutOrTerminationPromise: Promise<Error | null>;
  private _expectedLifecycle: LifecycleEvent[];
  private _frame: Frame;
  private _navigationRequest: network.Request | null = null;
  private _sameDocumentNavigationCompleteCallback: () => void;
  private _lifecycleCallback: () => void;
  private _newDocumentNavigationCompleteCallback: () => void;
  private _frameDetachedCallback: (err: Error) => void;
  private _navigationAbortedCallback: (err: Error) => void;
  private _maximumTimer: NodeJS.Timer;
  private _hasSameDocumentNavigation: boolean;
  private _targetUrl?: string;
  private _expectedDocumentId?: string;

  constructor(frame: Frame, waitUntil: LifecycleEvent | LifecycleEvent[], timeout: number) {
    if (Array.isArray(waitUntil))
      waitUntil = waitUntil.slice();
    else if (typeof waitUntil === 'string')
      waitUntil = [waitUntil];
    if (waitUntil.some(e => !kLifecycleEvents.has(e)))
      throw new Error('Unsupported waitUntil option');
    this._expectedLifecycle = waitUntil.slice();
    this._frame = frame;
    this.sameDocumentNavigationPromise = new Promise(f => this._sameDocumentNavigationCompleteCallback = f);
    this.lifecyclePromise = new Promise(f => this._lifecycleCallback = f);
    this.newDocumentNavigationPromise = new Promise(f => this._newDocumentNavigationCompleteCallback = f);
    this.timeoutOrTerminationPromise = Promise.race([
      this._createTimeoutPromise(timeout),
      new Promise<Error>(f => this._frameDetachedCallback = f),
      new Promise<Error>(f => this._navigationAbortedCallback = f),
      this._frame._page._disconnectedPromise.then(() => new Error('Navigation failed because browser has disconnected!')),
    ]);
    frame._page._frameManager._lifecycleWatchers.add(this);
    this._checkLifecycleComplete();
  }

  setExpectedDocumentId(documentId: string, url: string) {
    this._expectedDocumentId = documentId;
    this._targetUrl = url;
    if (this._navigationRequest && this._navigationRequest._documentId !== documentId)
      this._navigationRequest = null;
  }

  _onFrameDetached(frame: Frame) {
    if (this._frame === frame) {
      this._frameDetachedCallback.call(null, new Error('Navigating frame was detached'));
      return;
    }
    this._checkLifecycleComplete();
  }

  _onNavigatedWithinDocument(frame: Frame) {
    if (frame !== this._frame)
      return;
    this._hasSameDocumentNavigation = true;
    this._checkLifecycleComplete();
  }

  _onNavigationRequest(frame: Frame, request: network.Request) {
    assert(request._documentId);
    if (frame !== this._frame)
      return;
    if (this._expectedDocumentId === undefined || this._expectedDocumentId === request._documentId) {
      this._navigationRequest = request;
      this._expectedDocumentId = request._documentId;
      this._targetUrl = request.url();
    }
  }

  _onCommittedNewDocumentNavigation(frame: Frame) {
    if (frame === this._frame && this._expectedDocumentId === undefined) {
      this._expectedDocumentId = frame._lastDocumentId;
      this._targetUrl = frame.url();
    }
  }

  _onAbortedNewDocumentNavigation(frame: Frame, documentId: string, errorText: string) {
    if (frame === this._frame && documentId === this._expectedDocumentId) {
      if (this._targetUrl)
        this._navigationAbortedCallback(new Error('Navigation to ' + this._targetUrl + ' failed: ' + errorText));
      else
        this._navigationAbortedCallback(new Error('Navigation failed: ' + errorText));
    }
  }

  _onLifecycleEvent(frame: Frame) {
    this._checkLifecycleComplete();
  }

  navigationResponse(): Promise<network.Response | null> {
    return this._navigationRequest ? this._navigationRequest._finalRequest._waitForFinished() : null;
  }

  private _createTimeoutPromise(timeout: number): Promise<Error | null> {
    if (!timeout)
      return new Promise(() => {});
    const errorMessage = 'Navigation timeout of ' + timeout + ' ms exceeded';
    return new Promise(fulfill => this._maximumTimer = setTimeout(fulfill, timeout))
        .then(() => new TimeoutError(errorMessage));
  }

  private _checkLifecycleRecursively(frame: Frame, expectedLifecycle: LifecycleEvent[]): boolean {
    for (const event of expectedLifecycle) {
      if (!frame._firedLifecycleEvents.has(event))
        return false;
    }
    for (const child of frame.childFrames()) {
      if (!this._checkLifecycleRecursively(child, expectedLifecycle))
        return false;
    }
    return true;
  }

  private _checkLifecycleComplete() {
    // We expect navigation to commit.
    if (!this._checkLifecycleRecursively(this._frame, this._expectedLifecycle))
      return;
    this._lifecycleCallback();
    if (this._hasSameDocumentNavigation)
      this._sameDocumentNavigationCompleteCallback();
    if (this._frame._lastDocumentId === this._expectedDocumentId)
      this._newDocumentNavigationCompleteCallback();
  }

  dispose() {
    this._frame._page._frameManager._lifecycleWatchers.delete(this);
    clearTimeout(this._maximumTimer);
  }
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