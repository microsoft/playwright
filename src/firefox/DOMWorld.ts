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

import * as fs from 'fs';
import * as util from 'util';
import * as types from '../types';
import {ElementHandle, JSHandle} from './JSHandle';
import { ExecutionContext } from './ExecutionContext';
import { WaitTaskParams, WaitTask } from '../waitTask';

const readFileAsync = util.promisify(fs.readFile);

export class DOMWorld {
  _frame: any;
  _timeoutSettings: any;
  _documentPromise: any;
  _contextPromise: any;
  _contextResolveCallback: any;
  private _context: ExecutionContext | null;
  _waitTasks: Set<WaitTask<JSHandle>>;
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

  _setContext(context: ExecutionContext) {
    this._context = context;
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
    const params: WaitTaskParams = {
      predicateBody: pageFunction,
      title: 'function',
      polling,
      timeout,
      args
    };
    return this._scheduleWaitTask(params);
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

  private _scheduleWaitTask(params: WaitTaskParams): Promise<JSHandle> {
    const task = new WaitTask(params, () => this._waitTasks.delete(task));
    this._waitTasks.add(task);
    if (this._context)
      task.rerun(this._context);
    return task.promise;
  }
}
