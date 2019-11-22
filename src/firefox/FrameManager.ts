import { JugglerSession } from './Connection';
import { Page } from './Page';

import {RegisteredListener, helper, assert} from '../helper';
import {TimeoutError} from '../Errors';
import {EventEmitter} from 'events';
import {ExecutionContext} from './ExecutionContext';
import {NavigationWatchdog, NextNavigationWatchdog} from './NavigationWatchdog';
import {DOMWorld} from './DOMWorld';
import { JSHandle, ElementHandle } from './JSHandle';
import { TimeoutSettings } from '../TimeoutSettings';
import { NetworkManager } from './NetworkManager';
import { MultiClickOptions, ClickOptions, SelectOption } from '../input';

export const FrameManagerEvents = {
  FrameNavigated: Symbol('FrameManagerEvents.FrameNavigated'),
  FrameAttached: Symbol('FrameManagerEvents.FrameAttached'),
  FrameDetached: Symbol('FrameManagerEvents.FrameDetached'),
  Load: Symbol('FrameManagerEvents.Load'),
  DOMContentLoaded: Symbol('FrameManagerEvents.DOMContentLoaded'),
};
export class FrameManager extends EventEmitter {
  _session: JugglerSession;
  _page: Page;
  _networkManager: any;
  _timeoutSettings: any;
  _mainFrame: Frame;
  _frames: Map<string, Frame>;
  _contextIdToContext: Map<string, ExecutionContext>;
  _eventListeners: RegisteredListener[];
  constructor(session: JugglerSession, page: Page, networkManager, timeoutSettings) {
    super();
    this._session = session;
    this._page = page;
    this._networkManager = networkManager;
    this._timeoutSettings = timeoutSettings;
    this._mainFrame = null;
    this._frames = new Map();
    this._contextIdToContext = new Map();
    this._eventListeners = [
      helper.addEventListener(this._session, 'Page.eventFired', this._onEventFired.bind(this)),
      helper.addEventListener(this._session, 'Page.frameAttached', this._onFrameAttached.bind(this)),
      helper.addEventListener(this._session, 'Page.frameDetached', this._onFrameDetached.bind(this)),
      helper.addEventListener(this._session, 'Page.navigationCommitted', this._onNavigationCommitted.bind(this)),
      helper.addEventListener(this._session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)),
      helper.addEventListener(this._session, 'Runtime.executionContextCreated', this._onExecutionContextCreated.bind(this)),
      helper.addEventListener(this._session, 'Runtime.executionContextDestroyed', this._onExecutionContextDestroyed.bind(this)),
    ];
  }

  executionContextById(executionContextId) {
    return this._contextIdToContext.get(executionContextId) || null;
  }

  _onExecutionContextCreated({executionContextId, auxData}) {
    const frameId = auxData ? auxData.frameId : null;
    const frame = this._frames.get(frameId) || null;
    const context = new ExecutionContext(this._session, frame, executionContextId);
    if (frame)
      frame._mainWorld._setContext(context);
    this._contextIdToContext.set(executionContextId, context);
  }

  _onExecutionContextDestroyed({executionContextId}) {
    const context = this._contextIdToContext.get(executionContextId);
    if (!context)
      return;
    this._contextIdToContext.delete(executionContextId);
    if (context._frame)
      context._frame._mainWorld._setContext(null);
  }

  frame(frameId) {
    return this._frames.get(frameId);
  }

  mainFrame(): Frame {
    return this._mainFrame;
  }

  frames() {
    const frames: Array<Frame> = [];
    collect(this._mainFrame);
    return frames;

    function collect(frame) {
      frames.push(frame);
      for (const subframe of frame._children)
        collect(subframe);
    }
  }

  _onNavigationCommitted(params) {
    const frame = this._frames.get(params.frameId);
    frame._navigated(params.url, params.name, params.navigationId);
    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  _onSameDocumentNavigation(params) {
    const frame = this._frames.get(params.frameId);
    frame._url = params.url;
    this.emit(FrameManagerEvents.FrameNavigated, frame);
  }

  _onFrameAttached(params) {
    const frame = new Frame(this._session, this, this._networkManager, this._page, params.frameId, this._timeoutSettings);
    const parentFrame = this._frames.get(params.parentFrameId) || null;
    if (parentFrame) {
      frame._parentFrame = parentFrame;
      parentFrame._children.add(frame);
    } else {
      assert(!this._mainFrame, 'INTERNAL ERROR: re-attaching main frame!');
      this._mainFrame = frame;
    }
    this._frames.set(params.frameId, frame);
    this.emit(FrameManagerEvents.FrameAttached, frame);
  }

  _onFrameDetached(params) {
    const frame = this._frames.get(params.frameId);
    this._frames.delete(params.frameId);
    frame._detach();
    this.emit(FrameManagerEvents.FrameDetached, frame);
  }

  _onEventFired({frameId, name}) {
    const frame = this._frames.get(frameId);
    frame._firedEvents.add(name.toLowerCase());
    if (frame === this._mainFrame) {
      if (name === 'load')
        this.emit(FrameManagerEvents.Load);
      else if (name === 'DOMContentLoaded')
        this.emit(FrameManagerEvents.DOMContentLoaded);
    }
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }
}

export class Frame {
  _parentFrame: Frame|null = null;
  private _session: JugglerSession;
  _page: Page;
  _frameManager: FrameManager;
  private _networkManager: NetworkManager;
  private _timeoutSettings: TimeoutSettings;
  _frameId: string;
  _url: string = '';
  private _name: string = '';
  _children: Set<Frame>;
  private _detached: boolean;
  _firedEvents: Set<string>;
  _mainWorld: DOMWorld;
  _lastCommittedNavigationId: string;

  constructor(session: JugglerSession, frameManager : FrameManager, networkManager, page: Page, frameId: string, timeoutSettings) {
    this._session = session;
    this._page = page;
    this._frameManager = frameManager;
    this._networkManager = networkManager;
    this._timeoutSettings = timeoutSettings;
    this._frameId = frameId;
    this._children = new Set();
    this._detached = false;


    this._firedEvents = new Set();

    this._mainWorld = new DOMWorld(this, timeoutSettings);
  }

  async executionContext() {
    return this._mainWorld.executionContext();
  }

  async waitForNavigation(options: { timeout?: number; waitUntil?: string | Array<string>; } = {}) {
    const {
      timeout = this._timeoutSettings.navigationTimeout(),
      waitUntil = ['load'],
    } = options;
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const nextNavigationDog = new NextNavigationWatchdog(this._session, this);
    const error1 = await Promise.race([
      nextNavigationDog.promise(),
      timeoutPromise,
    ]);
    nextNavigationDog.dispose();

    // If timeout happened first - throw.
    if (error1) {
      clearTimeout(timeoutId);
      throw error1;
    }

    const {navigationId, url} = nextNavigationDog.navigation();

    if (!navigationId) {
      // Same document navigation happened.
      clearTimeout(timeoutId);
      return null;
    }

    const watchDog = new NavigationWatchdog(this._session, this, this._networkManager, navigationId, url, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
  }

  async goto(url: string, options: { timeout?: number; waitUntil?: string | Array<string>; referer?: string; } = {}) {
    const {
      timeout = this._timeoutSettings.navigationTimeout(),
      waitUntil = ['load'],
      referer,
    } = options;
    const normalizedWaitUntil = normalizeWaitUntil(waitUntil);
    const {navigationId} = await this._session.send('Page.navigate', {
      frameId: this._frameId,
      referer,
      url,
    });
    if (!navigationId)
      return;

    const timeoutError = new TimeoutError('Navigation timeout of ' + timeout + ' ms exceeded');
    let timeoutCallback;
    const timeoutPromise = new Promise(resolve => timeoutCallback = resolve.bind(null, timeoutError));
    const timeoutId = timeout ? setTimeout(timeoutCallback, timeout) : null;

    const watchDog = new NavigationWatchdog(this._session, this, this._networkManager, navigationId, url, normalizedWaitUntil);
    const error = await Promise.race([
      timeoutPromise,
      watchDog.promise(),
    ]);
    watchDog.dispose();
    clearTimeout(timeoutId);
    if (error)
      throw error;
    return watchDog.navigationResponse();
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

  _detach() {
    this._parentFrame._children.delete(this);
    this._parentFrame = null;
    this._detached = true;
    this._mainWorld._detach();
  }

  _navigated(url, name, navigationId) {
    this._url = url;
    this._name = name;
    this._lastCommittedNavigationId = navigationId;
    this._firedEvents.clear();
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: { polling?: string | number; timeout?: number; visible?: boolean; hidden?: boolean; } | undefined, ...args: Array<any>): Promise<JSHandle> {
    const xPathPattern = '//';

    if (helper.isString(selectorOrFunctionOrTimeout)) {
      const string = selectorOrFunctionOrTimeout;
      if (string.startsWith(xPathPattern))
        return this.waitForXPath(string, options);
      return this.waitForSelector(string, options);
    }
    if (helper.isNumber(selectorOrFunctionOrTimeout))
      return new Promise(fulfill => setTimeout(fulfill, selectorOrFunctionOrTimeout));
    if (typeof selectorOrFunctionOrTimeout === 'function')
      return this.waitForFunction(selectorOrFunctionOrTimeout, options, ...args);
    return Promise.reject(new Error('Unsupported target type: ' + (typeof selectorOrFunctionOrTimeout)));
  }

  waitForFunction(pageFunction: Function | string, options: { polling?: string | number; timeout?: number; } | undefined = {}, ...args): Promise<JSHandle> {
    return this._mainWorld.waitForFunction(pageFunction, options, ...args);
  }

  waitForSelector(selector: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined): Promise<ElementHandle> {
    return this._mainWorld.waitForSelector(selector, options);
  }

  waitForXPath(xpath: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined): Promise<ElementHandle> {
    return this._mainWorld.waitForXPath(xpath, options);
  }

  async content(): Promise<string> {
    return this._mainWorld.content();
  }

  async setContent(html: string) {
    return this._mainWorld.setContent(html);
  }

  async evaluate(pageFunction, ...args): Promise<any> {
    return this._mainWorld.evaluate(pageFunction, ...args);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    return this._mainWorld.$(selector);
  }

  async $$(selector: string): Promise<Array<ElementHandle>> {
    return this._mainWorld.$$(selector);
  }

  async $eval(selector: string, pageFunction: Function | string, ...args: Array<any>): Promise<(object | undefined)> {
    return this._mainWorld.$eval(selector, pageFunction, ...args);
  }

  async $$eval(selector: string, pageFunction: Function | string, ...args: Array<any>): Promise<(object | undefined)> {
    return this._mainWorld.$$eval(selector, pageFunction, ...args);
  }

  async $x(expression: string): Promise<Array<ElementHandle>> {
    return this._mainWorld.$x(expression);
  }

  async evaluateHandle(pageFunction, ...args): Promise<JSHandle> {
    return this._mainWorld.evaluateHandle(pageFunction, ...args);
  }

  async addScriptTag(options: { content?: string; path?: string; type?: string; url?: string; }): Promise<ElementHandle> {
    return this._mainWorld.addScriptTag(options);
  }

  async addStyleTag(options: { content?: string; path?: string; url?: string; }): Promise<ElementHandle> {
    return this._mainWorld.addStyleTag(options);
  }

  async title(): Promise<string> {
    return this._mainWorld.title();
  }

  name() {
    return this._name;
  }

  isDetached() {
    return this._detached;
  }

  childFrames() {
    return Array.from(this._children);
  }

  url() {
    return this._url;
  }

  parentFrame() {
    return this._parentFrame;
  }
}

export function normalizeWaitUntil(waitUntil) {
  if (!Array.isArray(waitUntil))
    waitUntil = [waitUntil];
  for (const condition of waitUntil) {
    if (condition !== 'load' && condition !== 'domcontentloaded')
      throw new Error('Unknown waitUntil condition: ' + condition);
  }
  return waitUntil;
}
