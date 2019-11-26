/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { JugglerSession } from './Connection';
import { Page } from './Page';
import * as fs from 'fs';
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
import * as types from '../types';

const readFileAsync = helper.promisify(fs.readFile);

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
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.click(options);
    await handle.dispose();
  }

  async dblclick(selector: string, options?: MultiClickOptions) {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.dblclick(options);
    await handle.dispose();
  }

  async tripleclick(selector: string, options?: MultiClickOptions) {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.tripleclick(options);
    await handle.dispose();
  }

  async select(selector: string, ...values: (string | ElementHandle | SelectOption)[]): Promise<string[]> {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    const result = await handle.select(...values);
    await handle.dispose();
    return result;
  }

  async fill(selector: string, value: string) {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.fill(value);
    await handle.dispose();
  }

  async type(selector: string, text: string, options: { delay: (number | undefined); } | undefined) {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.type(text, options);
    await handle.dispose();
  }

  async focus(selector: string) {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
    assert(handle, 'No node found for selector: ' + selector);
    await handle.focus();
    await handle.dispose();
  }

  async hover(selector: string) {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    const handle = await document.$(selector);
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
    const context = await this._mainWorld.executionContext();
    return context.evaluate(() => {
      let retVal = '';
      if (document.doctype)
        retVal = new XMLSerializer().serializeToString(document.doctype);
      if (document.documentElement)
        retVal += document.documentElement.outerHTML;
      return retVal;
    });
  }

  async setContent(html: string) {
    const context = await this._mainWorld.executionContext();
    await context.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
  }

  evaluate: types.Evaluate<JSHandle> = async (pageFunction, ...args) => {
    const context = await this._mainWorld.executionContext();
    return context.evaluate(pageFunction, ...args as any);
  }

  async $(selector: string): Promise<ElementHandle | null> {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    return document.$(selector);
  }

  async $$(selector: string): Promise<Array<ElementHandle>> {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    return document.$$(selector);
  }

  $eval: types.$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    return document.$eval(selector, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    return document.$$eval(selector, pageFunction, ...args as any);
  }

  async $x(expression: string): Promise<Array<ElementHandle>> {
    const context = await this._mainWorld.executionContext();
    const document = await context._document();
    return document.$x(expression);
  }

  evaluateHandle: types.EvaluateHandle<JSHandle> = async (pageFunction, ...args) => {
    const context = await this._mainWorld.executionContext();
    return context.evaluateHandle(pageFunction, ...args as any);
  }

  async addScriptTag(options: {
      url?: string; path?: string;
      content?: string;
      type?: string;
    }): Promise<ElementHandle> {
    const {
      url = null,
      path = null,
      content = null,
      type = ''
    } = options;
    if (url !== null) {
      try {
        const context = await this._mainWorld.executionContext();
        return (await context.evaluateHandle(addScriptUrl, url, type)).asElement();
      } catch (error) {
        throw new Error(`Loading script from ${url} failed`);
      }
    }

    if (path !== null) {
      let contents = await readFileAsync(path, 'utf8');
      contents += '//# sourceURL=' + path.replace(/\n/g, '');
      const context = await this._mainWorld.executionContext();
      return (await context.evaluateHandle(addScriptContent, contents, type)).asElement();
    }

    if (content !== null) {
      const context = await this._mainWorld.executionContext();
      return (await context.evaluateHandle(addScriptContent, content, type)).asElement();
    }

    throw new Error('Provide an object with a `url`, `path` or `content` property');

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

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    const {
      url = null,
      path = null,
      content = null
    } = options;
    if (url !== null) {
      try {
        const context = await this._mainWorld.executionContext();
        return (await context.evaluateHandle(addStyleUrl, url)).asElement();
      } catch (error) {
        throw new Error(`Loading style from ${url} failed`);
      }
    }

    if (path !== null) {
      let contents = await readFileAsync(path, 'utf8');
      contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
      const context = await this._mainWorld.executionContext();
      return (await context.evaluateHandle(addStyleContent, contents)).asElement();
    }

    if (content !== null) {
      const context = await this._mainWorld.executionContext();
      return (await context.evaluateHandle(addStyleContent, content)).asElement();
    }

    throw new Error('Provide an object with a `url`, `path` or `content` property');

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

  async title(): Promise<string> {
    const context = await this._mainWorld.executionContext();
    return context.evaluate(() => document.title);
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
