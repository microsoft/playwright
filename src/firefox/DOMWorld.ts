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

import {helper, assert} from '../helper';
import {TimeoutError} from '../Errors';
import * as fs from 'fs';
import * as util from 'util';
import * as types from '../types';
import {ElementHandle, JSHandle} from './JSHandle';
import { ExecutionContext } from './ExecutionContext';

const readFileAsync = util.promisify(fs.readFile);

export class DOMWorld {
  _frame: any;
  _timeoutSettings: any;
  _documentPromise: any;
  _contextPromise: any;
  _contextResolveCallback: any;
  _waitTasks: Set<WaitTask>;
  _detached: boolean;
  constructor(frame, timeoutSettings) {
    this._frame = frame;
    this._timeoutSettings = timeoutSettings;

    this._documentPromise = null;
    this._contextPromise;
    this._contextResolveCallback = null;
    this._setContext(null);

    this._waitTasks = new Set();
    this._detached = false;
  }

  frame() {
    return this._frame;
  }

  _setContext(context) {
    if (context) {
      this._contextResolveCallback.call(null, context);
      this._contextResolveCallback = null;
      for (const waitTask of this._waitTasks)
        waitTask.rerun();
    } else {
      this._documentPromise = null;
      this._contextPromise = new Promise(fulfill => {
        this._contextResolveCallback = fulfill;
      });
    }
  }

  _detach() {
    this._detached = true;
    for (const waitTask of this._waitTasks)
      waitTask.terminate(new Error('waitForFunction failed: frame got detached.'));
  }

  async executionContext(): Promise<ExecutionContext> {
    if (this._detached)
      throw new Error(`Execution Context is not available in detached frame "${this.url()}" (are you trying to evaluate?)`);
    return this._contextPromise;
  }
  url() {
    throw new Error('Method not implemented.');
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
    return document.$(selector);
  }

  _document() {
    if (!this._documentPromise)
      this._documentPromise = this.evaluateHandle('document').then(handle => handle.asElement());
    return this._documentPromise;
  }

  async $x(expression: string): Promise<Array<ElementHandle>> {
    const document = await this._document();
    return document.$x(expression);
  }

  $eval: types.$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const document = await this._document();
    return document.$eval(selector, pageFunction, ...args);
  }

  $$eval: types.$$Eval<JSHandle> = async (selector, pageFunction, ...args) => {
    const document = await this._document();
    return document.$$eval(selector, pageFunction, ...args);
  }

  async $$(selector: string): Promise<Array<ElementHandle>> {
    const document = await this._document();
    return document.$$(selector);
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

  async setContent(html: string) {
    await this.evaluate(html => {
      document.open();
      document.write(html);
      document.close();
    }, html);
  }

  async addScriptTag(options: { content?: string; path?: string; type?: string; url?: string; }): Promise<ElementHandle> {
    if (typeof options.url === 'string') {
      const url = options.url;
      try {
        return (await this.evaluateHandle(addScriptUrl, url, options.type)).asElement();
      } catch (error) {
        throw new Error(`Loading script from ${url} failed`);
      }
    }

    if (typeof options.path === 'string') {
      let contents = await readFileAsync(options.path, 'utf8');
      contents += '//# sourceURL=' + options.path.replace(/\n/g, '');
      return (await this.evaluateHandle(addScriptContent, contents, options.type)).asElement();
    }

    if (typeof options.content === 'string')
      return (await this.evaluateHandle(addScriptContent, options.content, options.type)).asElement();


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

  async addStyleTag(options: { content?: string; path?: string; url?: string; }): Promise<ElementHandle> {
    if (typeof options.url === 'string') {
      const url = options.url;
      try {
        return (await this.evaluateHandle(addStyleUrl, url)).asElement();
      } catch (error) {
        throw new Error(`Loading style from ${url} failed`);
      }
    }

    if (typeof options.path === 'string') {
      let contents = await readFileAsync(options.path, 'utf8');
      contents += '/*# sourceURL=' + options.path.replace(/\n/g, '') + '*/';
      return (await this.evaluateHandle(addStyleContent, contents)).asElement();
    }

    if (typeof options.content === 'string')
      return (await this.evaluateHandle(addStyleContent, options.content)).asElement();


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

  waitForSelector(selector: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined): Promise<ElementHandle> {
    return this._waitForSelectorOrXPath(selector, false, options);
  }

  waitForXPath(xpath: string, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined): Promise<ElementHandle> {
    return this._waitForSelectorOrXPath(xpath, true, options);
  }

  waitForFunction(pageFunction: Function | string, options: { polling?: string | number; timeout?: number; } | undefined = {}, ...args): Promise<JSHandle> {
    const {
      polling = 'raf',
      timeout = this._timeoutSettings.timeout(),
    } = options;
    return new WaitTask(this, pageFunction, 'function', polling, timeout, ...args).promise;
  }

  async title(): Promise<string> {
    return this.evaluate(() => document.title);
  }

  async _waitForSelectorOrXPath(selectorOrXPath: string, isXPath: boolean, options: { timeout?: number; visible?: boolean; hidden?: boolean; } | undefined = {}): Promise<ElementHandle> {
    const {
      visible: waitForVisible = false,
      hidden: waitForHidden = false,
      timeout = this._timeoutSettings.timeout(),
    } = options;
    const polling = waitForVisible || waitForHidden ? 'raf' : 'mutation';
    const title = `${isXPath ? 'XPath' : 'selector'} "${selectorOrXPath}"${waitForHidden ? ' to be hidden' : ''}`;
    const waitTask = new WaitTask(this, predicate, title, polling, timeout, selectorOrXPath, isXPath, waitForVisible, waitForHidden);
    const handle = await waitTask.promise;
    if (!handle.asElement()) {
      await handle.dispose();
      return null;
    }
    return handle.asElement();

    function predicate(selectorOrXPath: string, isXPath: boolean, waitForVisible: boolean, waitForHidden: boolean): (Node | boolean) | null {
      const node = isXPath
        ? document.evaluate(selectorOrXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        : document.querySelector(selectorOrXPath);
      if (!node)
        return waitForHidden;
      if (!waitForVisible && !waitForHidden)
        return node;
      const element: Element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element;

      const style = window.getComputedStyle(element);
      const isVisible = style && style.visibility !== 'hidden' && hasVisibleBoundingBox();
      const success = (waitForVisible === isVisible || waitForHidden === !isVisible);
      return success ? node : null;

      function hasVisibleBoundingBox(): boolean {
        const rect = element.getBoundingClientRect();
        return !!(rect.top || rect.bottom || rect.width || rect.height);
      }
    }
  }
}

class WaitTask {
  promise: any;
  _domWorld: any;
  _polling: any;
  _timeout: any;
  _predicateBody: string;
  _args: any[];
  _runCount: number;
  _resolve: (value?: unknown) => void;
  _reject: (reason?: any) => void;
  _timeoutTimer: NodeJS.Timer;
  _terminated: boolean;
  _runningTask: any;
  constructor(domWorld: DOMWorld, predicateBody: Function | string, title, polling: string | number, timeout: number, ...args: Array<any>) {
    if (helper.isString(polling))
      assert(polling === 'raf' || polling === 'mutation', 'Unknown polling option: ' + polling);
    else if (helper.isNumber(polling))
      assert(polling > 0, 'Cannot poll with non-positive interval: ' + polling);
    else
      throw new Error('Unknown polling options: ' + polling);

    this._domWorld = domWorld;
    this._polling = polling;
    this._timeout = timeout;
    this._predicateBody = helper.isString(predicateBody) ? 'return (' + predicateBody + ')' : 'return (' + predicateBody + ')(...args)';
    this._args = args;
    this._runCount = 0;
    domWorld._waitTasks.add(this);
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    // Since page navigation requires us to re-install the pageScript, we should track
    // timeout on our end.
    if (timeout) {
      const timeoutError = new TimeoutError(`waiting for ${title} failed: timeout ${timeout}ms exceeded`);
      this._timeoutTimer = setTimeout(() => this.terminate(timeoutError), timeout);
    }
    this.rerun();
  }

  terminate(error: Error) {
    this._terminated = true;
    this._reject(error);
    this._cleanup();
  }

  async rerun() {
    const runCount = ++this._runCount;
    let success: JSHandle | null = null;
    let error = null;
    try {
      success = await this._domWorld.evaluateHandle(waitForPredicatePageFunction, this._predicateBody, this._polling, this._timeout, ...this._args);
    } catch (e) {
      error = e;
    }

    if (this._terminated || runCount !== this._runCount) {
      if (success)
        await success.dispose();
      return;
    }

    // Ignore timeouts in pageScript - we track timeouts ourselves.
    // If the frame's execution context has already changed, `frame.evaluate` will
    // throw an error - ignore this predicate run altogether.
    if (!error && await this._domWorld.evaluate(s => !s, success).catch(e => true)) {
      await success.dispose();
      return;
    }

    // When the page is navigated, the promise is rejected.
    // Try again right away.
    if (error && error.message.includes('Execution context was destroyed')) {
      this.rerun();
      return;
    }

    if (error)
      this._reject(error);
    else
      this._resolve(success);

    this._cleanup();
  }

  _cleanup() {
    clearTimeout(this._timeoutTimer);
    this._domWorld._waitTasks.delete(this);
    this._runningTask = null;
  }
}

async function waitForPredicatePageFunction(predicateBody: string, polling: string, timeout: number, ...args): Promise<any> {
  const predicate = new Function('...args', predicateBody);
  let timedOut = false;
  if (timeout)
    setTimeout(() => timedOut = true, timeout);
  if (polling === 'raf')
    return await pollRaf();
  if (polling === 'mutation')
    return await pollMutation();
  if (typeof polling === 'number')
    return await pollInterval(polling);

  function pollMutation(): Promise<any> {
    const success = predicate.apply(null, args);
    if (success)
      return Promise.resolve(success);

    let fulfill;
    const result = new Promise(x => fulfill = x);
    const observer = new MutationObserver(mutations => {
      if (timedOut) {
        observer.disconnect();
        fulfill();
      }
      const success = predicate.apply(null, args);
      if (success) {
        observer.disconnect();
        fulfill(success);
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true
    });
    return result;
  }

  function pollRaf(): Promise<any> {
    let fulfill;
    const result = new Promise(x => fulfill = x);
    onRaf();
    return result;

    function onRaf() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicate.apply(null, args);
      if (success)
        fulfill(success);
      else
        requestAnimationFrame(onRaf);
    }
  }

  function pollInterval(pollInterval: number): Promise<any> {
    let fulfill;
    const result = new Promise(x => fulfill = x);
    onTimeout();
    return result;

    function onTimeout() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicate.apply(null, args);
      if (success)
        fulfill(success);
      else
        setTimeout(onTimeout, pollInterval);
    }
  }
}
