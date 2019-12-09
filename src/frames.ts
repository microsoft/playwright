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
import { helper, assert } from './helper';
import { ClickOptions, MultiClickOptions, PointerActionOptions, SelectOption } from './input';
import { TimeoutSettings } from './TimeoutSettings';
import { TimeoutError } from './Errors';

const readFileAsync = helper.promisify(fs.readFile);

type WorldType = 'main' | 'utility';
type World = {
  contextPromise: Promise<js.ExecutionContext>;
  contextResolveCallback: (c: js.ExecutionContext) => void;
  context: js.ExecutionContext | null;
  rerunnableTasks: Set<RerunnableTask>;
};

export type NavigateOptions = {
  timeout?: number,
  waitUntil?: string | string[],
};

export type GotoOptions = NavigateOptions & {
  referer?: string,
};

export interface FrameDelegate {
  navigateFrame(frame: Frame, url: string, options?: GotoOptions): Promise<network.Response | null>;
  waitForFrameNavigation(frame: Frame, options?: NavigateOptions): Promise<network.Response | null>;
  setFrameContent(frame: Frame, html: string, options?: NavigateOptions): Promise<void>;
}

export class Frame {
  _delegate: FrameDelegate;
  private _timeoutSettings: TimeoutSettings;
  private _parentFrame: Frame;
  private _url = '';
  private _detached = false;
  private _worlds = new Map<WorldType, World>();
  private _childFrames = new Set<Frame>();
  private _name: string;

  constructor(delegate: FrameDelegate, timeoutSettings: TimeoutSettings, parentFrame: Frame | null) {
    this._delegate = delegate;
    this._timeoutSettings = timeoutSettings;
    this._parentFrame = parentFrame;

    this._worlds.set('main', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._worlds.set('utility', { contextPromise: new Promise(() => {}), contextResolveCallback: () => {}, context: null, rerunnableTasks: new Set() });
    this._setContext('main', null);
    this._setContext('utility', null);

    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
  }

  goto(url: string, options?: GotoOptions): Promise<network.Response | null> {
    return this._delegate.navigateFrame(this, url, options);
  }

  waitForNavigation(options?: NavigateOptions): Promise<network.Response | null> {
    return this._delegate.waitForFrameNavigation(this, options);
  }

  _mainContext(): Promise<js.ExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._worlds.get('main').contextPromise;
  }

  async _mainDOMWorld(): Promise<dom.DOMWorld> {
    const context = await this._mainContext();
    if (!context._domWorld)
      throw new Error(`Execution Context does not belong to frame`);
    return context._domWorld;
  }

  _utilityContext(): Promise<js.ExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._worlds.get('utility').contextPromise;
  }

  async _utilityDOMWorld(): Promise<dom.DOMWorld> {
    const context = await this._utilityContext();
    if (!context._domWorld)
      throw new Error(`Execution Context does not belong to frame`);
    return context._domWorld;
  }

  executionContext(): Promise<js.ExecutionContext> {
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

  async $(selector: string | types.Selector): Promise<dom.ElementHandle<Element> | null> {
    const domWorld = await this._mainDOMWorld();
    return domWorld.$(types.clearSelector(selector));
  }

  async $x(expression: string): Promise<dom.ElementHandle<Element>[]> {
    const domWorld = await this._mainDOMWorld();
    return domWorld.$$('xpath=' + expression);
  }

  $eval: types.$Eval = async (selector, pageFunction, ...args) => {
    const domWorld = await this._mainDOMWorld();
    return domWorld.$eval(selector, pageFunction, ...args as any);
  }

  $$eval: types.$$Eval = async (selector, pageFunction, ...args) => {
    const domWorld = await this._mainDOMWorld();
    return domWorld.$$eval(selector, pageFunction, ...args as any);
  }

  async $$(selector: string | types.Selector): Promise<dom.ElementHandle<Element>[]> {
    const domWorld = await this._mainDOMWorld();
    return domWorld.$$(types.clearSelector(selector));
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

  setContent(html: string, options?: NavigateOptions) {
    return this._delegate.setFrameContent(this, html, options);
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
    if (url !== null) {
      try {
        const context = await this._mainContext();
        return (await context.evaluateHandle(addScriptUrl, url, type)).asElement();
      } catch (error) {
        throw new Error(`Loading script from ${url} failed`);
      }
    }

    if (path !== null) {
      let contents = await readFileAsync(path, 'utf8');
      contents += '//# sourceURL=' + path.replace(/\n/g, '');
      const context = await this._mainContext();
      return (await context.evaluateHandle(addScriptContent, contents, type)).asElement();
    }

    if (content !== null) {
      const context = await this._mainContext();
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

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<dom.ElementHandle> {
    const {
      url = null,
      path = null,
      content = null
    } = options;
    if (url !== null) {
      try {
        const context = await this._mainContext();
        return (await context.evaluateHandle(addStyleUrl, url)).asElement();
      } catch (error) {
        throw new Error(`Loading style from ${url} failed`);
      }
    }

    if (path !== null) {
      let contents = await readFileAsync(path, 'utf8');
      contents += '/*# sourceURL=' + path.replace(/\n/g, '') + '*/';
      const context = await this._mainContext();
      return (await context.evaluateHandle(addStyleContent, contents)).asElement();
    }

    if (content !== null) {
      const context = await this._mainContext();
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

  async click(selector: string | types.Selector, options?: ClickOptions) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.click(options);
    await handle.dispose();
  }

  async dblclick(selector: string | types.Selector, options?: MultiClickOptions) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.dblclick(options);
    await handle.dispose();
  }

  async tripleclick(selector: string | types.Selector, options?: MultiClickOptions) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.tripleclick(options);
    await handle.dispose();
  }

  async fill(selector: string | types.Selector, value: string) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.fill(value);
    await handle.dispose();
  }

  async focus(selector: string | types.Selector) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.focus();
    await handle.dispose();
  }

  async hover(selector: string | types.Selector, options?: PointerActionOptions) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.hover(options);
    await handle.dispose();
  }

  async select(selector: string | types.Selector, ...values: (string | dom.ElementHandle | SelectOption)[]): Promise<string[]> {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    const toDispose: Promise<dom.ElementHandle>[] = [];
    const adoptedValues = await Promise.all(values.map(async value => {
      if (value instanceof dom.ElementHandle && value.executionContext() !== domWorld.context) {
        const adopted = domWorld.adoptElementHandle(value);
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

  async type(selector: string | types.Selector, text: string, options: { delay: (number | undefined); } | undefined) {
    const domWorld = await this._utilityDOMWorld();
    const handle = await domWorld.$(types.clearSelector(selector));
    assert(handle, 'No node found for selector: ' + types.selectorToString(selector));
    await handle.type(text, options);
    await handle.dispose();
  }

  waitFor(selectorOrFunctionOrTimeout: (string | number | Function), options: any = {}, ...args: any[]): Promise<js.JSHandle | null> {
    if (helper.isString(selectorOrFunctionOrTimeout))
      return this.waitForSelector(selectorOrFunctionOrTimeout as string, options) as any;
    if (helper.isNumber(selectorOrFunctionOrTimeout))
      return new Promise(fulfill => setTimeout(fulfill, selectorOrFunctionOrTimeout as number));
    if (typeof selectorOrFunctionOrTimeout === 'function')
      return this.waitForFunction(selectorOrFunctionOrTimeout, options, ...args);
    return Promise.reject(new Error('Unsupported target type: ' + (typeof selectorOrFunctionOrTimeout)));
  }

  async waitForSelector(selector: string | types.Selector, options: types.TimeoutOptions = {}): Promise<dom.ElementHandle | null> {
    const { timeout = this._timeoutSettings.timeout() } = options;
    const task = dom.waitForSelectorTask(types.clearSelector(selector), timeout);
    const handle = await this._scheduleRerunnableTask(task, 'utility', timeout, `selector "${types.selectorToString(selector)}"`);
    if (!handle.asElement()) {
      await handle.dispose();
      return null;
    }
    const mainDOMWorld = await this._mainDOMWorld();
    if (handle.executionContext() === mainDOMWorld.context)
      return handle.asElement();
    const adopted = await mainDOMWorld.adoptElementHandle(handle.asElement());
    await handle.dispose();
    return adopted;
  }

  async waitForXPath(xpath: string, options: types.TimeoutOptions = {}): Promise<dom.ElementHandle | null> {
    return this.waitForSelector('xpath=' + xpath, options);
  }

  waitForFunction(pageFunction: Function | string, options: types.WaitForFunctionOptions = {}, ...args: any[]): Promise<js.JSHandle> {
    options = { timeout: this._timeoutSettings.timeout(), ...options };
    const task = dom.waitForFunctionTask(pageFunction, options, ...args);
    return this._scheduleRerunnableTask(task, 'main', options.timeout);
  }

  async title(): Promise<string> {
    const context = await this._utilityContext();
    return context.evaluate(() => document.title);
  }

  _navigated(url: string, name: string) {
    this._url = url;
    this._name = name;
  }

  _detach() {
    this._detached = true;
    for (const world of this._worlds.values()) {
      for (const rerunnableTask of world.rerunnableTasks)
        rerunnableTask.terminate(new Error('waitForFunction failed: frame got detached.'));
    }
    if (this._parentFrame)
      this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  private _scheduleRerunnableTask(task: dom.Task, worldType: WorldType, timeout?: number, title?: string): Promise<js.JSHandle> {
    const world = this._worlds.get(worldType);
    const rerunnableTask = new RerunnableTask(world, task, timeout, title);
    world.rerunnableTasks.add(rerunnableTask);
    if (world.context)
      rerunnableTask.rerun(world.context._domWorld);
    return rerunnableTask.promise;
  }

  private _setContext(worldType: WorldType, context: js.ExecutionContext | null) {
    const world = this._worlds.get(worldType);
    world.context = context;
    if (context) {
      assert(context._domWorld, 'Frame context must have a dom world');
      world.contextResolveCallback.call(null, context);
      for (const rerunnableTask of world.rerunnableTasks)
        rerunnableTask.rerun(context._domWorld);
    } else {
      world.contextPromise = new Promise(fulfill => {
        world.contextResolveCallback = fulfill;
      });
    }
  }

  _contextCreated(worldType: WorldType, context: js.ExecutionContext) {
    const world = this._worlds.get(worldType);
    // In case of multiple sessions to the same target, there's a race between
    // connections so we might end up creating multiple isolated worlds.
    // We can use either.
    if (world.context)
      this._setContext(worldType, null);
    this._setContext(worldType, context);
  }

  _contextDestroyed(context: js.ExecutionContext) {
    for (const [worldType, world] of this._worlds) {
      if (world.context === context)
        this._setContext(worldType, null);
    }
  }
}

class RerunnableTask {
  readonly promise: Promise<js.JSHandle>;
  private _world: World;
  private _task: dom.Task;
  private _runCount: number;
  private _resolve: (result: js.JSHandle) => void;
  private _reject: (reason: Error) => void;
  private _timeoutTimer: NodeJS.Timer;
  private _terminated: boolean;

  constructor(world: World, task: dom.Task, timeout?: number, title?: string) {
    this._world = world;
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

  async rerun(domWorld: dom.DOMWorld) {
    const runCount = ++this._runCount;
    let success: js.JSHandle | null = null;
    let error = null;
    try {
      success = await this._task(domWorld);
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
    if (!error && await domWorld.context.evaluate(s => !s, success).catch(e => true)) {
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
    this._world.rerunnableTasks.delete(this);
  }
}
