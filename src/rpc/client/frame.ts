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

import { assertMaxArguments, helper } from '../../helper';
import * as types from '../../types';
import { FrameChannel, FrameInitializer, FrameNavigatedEvent } from '../channels';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { ElementHandle, convertSelectOptionValues } from './elementHandle';
import { JSHandle, Func1, FuncOn, SmartHandle, serializeArgument, parseResult } from './jsHandle';
import * as network from './network';
import { Page } from './page';
import { ConnectionScope } from './connection';
import { normalizeFilePayloads } from '../serializers';
import { Events } from '../../events';
import { EventEmitter } from 'events';
import { rewriteErrorMessage } from '../../utils/stackTrace';

export type GotoOptions = types.NavigateOptions & {
  referer?: string,
};

export type FunctionWithSource = (source: { context: BrowserContext, page: Page, frame: Frame }, ...args: any) => any;

export class Frame extends ChannelOwner<FrameChannel, FrameInitializer> {
  _eventEmitter: EventEmitter;
  _lifecycleEvents = new Set<types.LifecycleEvent>();
  _parentFrame: Frame | null = null;
  _url = '';
  _name = '';
  _detached = false;
  _childFrames = new Set<Frame>();
  _page: Page | undefined;

  static from(frame: FrameChannel): Frame {
    return (frame as any)._object;
  }

  static fromNullable(frame: FrameChannel | null): Frame | null {
    return frame ? Frame.from(frame) : null;
  }

  constructor(scope: ConnectionScope, guid: string, initializer: FrameInitializer) {
    super(scope, guid, initializer);
    this._eventEmitter = new EventEmitter();
    this._eventEmitter.setMaxListeners(0);
    this._parentFrame = Frame.fromNullable(initializer.parentFrame);
    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
    this._name = initializer.name;
    this._url = initializer.url;

    this._channel.on('navigated', event => {
      this._url = event.url;
      this._name = event.name;
      this._eventEmitter.emit('navigated', event);
      if (!event.error && this._page)
        this._page.emit(Events.Page.FrameNavigated, this);
    });
    this._channel.on('lifecycle', event => {
      if (event.add) {
        this._lifecycleEvents.add(event.add);
        this._eventEmitter.emit('lifecycle', event.add);
      }
      if (event.remove)
        this._lifecycleEvents.delete(event.remove);
    });
  }

  async goto(url: string, options: GotoOptions = {}): Promise<network.Response | null> {
    return network.Response.fromNullable(await this._channel.goto({ url, ...options, isPage: this._page!._isPageCall }));
  }

  async waitForNavigation(options: types.WaitForNavigationOptions = {}): Promise<network.Response | null> {
    const timeout = this._page!._timeoutSettings.navigationTimeout(options);
    const apiName = this._page!._isPageCall ? 'page.waitForNavigation' : 'frame.waitForNavigation';
    const waitUntil = verifyLifecycle(options.waitUntil === undefined ? 'load' : options.waitUntil);

    const logs: string[] = [];
    const toUrl = typeof options.url === 'string' ? ` to "${options.url}"` : '';
    logs.push(`waiting for navigation${toUrl} until "${waitUntil}"`);

    const pageClosed = waitForEvent(this._page!, Events.Page.Close);
    const pageCrashed = waitForEvent(this._page!, Events.Page.Crash);
    const frameDetached = waitForEvent(this._page!, Events.Page.FrameDetached, (frame: Frame) => frame === this);
    let timeoutId;
    const timeoutPromise = new Promise(f => timeoutId = setTimeout(f, timeout));
    const failPromise = Promise.race([
      pageClosed.promise.then(() => new Error('Navigation failed because page was closed!')),
      pageCrashed.promise.then(() => new Error('Navigation failed because page crashed!')),
      frameDetached.promise.then(() => new Error('Navigating frame was detached!')),
      timeoutPromise.then(() => new Error(`Timeout ${timeout}ms exceeded during ${apiName}.`)),
    ]);

    const navigated = waitForEvent(this._eventEmitter, 'navigated', (event: FrameNavigatedEvent) => {
      // Any failed navigation results in a rejection.
      if (event.error)
        return true;
      logs.push(`  navigated to "${this._url}"`);
      return helper.urlMatches(event.url, options.url);
    });

    let error: Error | undefined;
    let request: network.Request | null = null;

    const navigatedResult = await Promise.race([failPromise, navigated.promise]);
    navigated.dispose();
    if (navigatedResult instanceof Error) {
      error = navigatedResult;
    } else {
      const navigationEvent = navigatedResult as FrameNavigatedEvent;
      if (navigationEvent.error) {
        error = new Error(navigationEvent.error);
        error.stack = '';
      } else {
        request = navigationEvent.newDocument ? network.Request.fromNullable(navigationEvent.newDocument.request || null) : null;
      }
    }

    if (!error && !this._lifecycleEvents.has(waitUntil)) {
      const lifecycle = waitForEvent(this._eventEmitter, 'lifecycle', (e: types.LifecycleEvent) => e === waitUntil);
      const lifecycleResult = await Promise.race([failPromise, lifecycle.promise]);
      lifecycle.dispose();
      if (lifecycleResult instanceof Error)
        error = lifecycleResult;
    }

    let response: network.Response | null = null;
    if (!error && request) {
      const responseOrError = await Promise.race([failPromise, request._finalRequest().response()]);
      if (responseOrError instanceof Error)
        error = responseOrError;
      else
        response = responseOrError;
    }

    pageCrashed.dispose();
    pageCrashed.dispose();
    frameDetached.dispose();
    clearTimeout(timeoutId);

    if (error) {
      rewriteErrorMessage(error,
          error.message +
          `\n=============== logs ===============\n` +
          logs.map(log => '[api]  ' + log).join('\n') +
          `\n====================================\nNote: use DEBUG=pw:api environment variable and rerun to capture Playwright logs.`);
      throw error;
    }
    return response;
  }

  async waitForLoadState(state: types.LifecycleEvent = 'load', options: types.TimeoutOptions = {}): Promise<void> {
    await this._channel.waitForLoadState({ state, ...options, isPage: this._page!._isPageCall });
  }

  async frameElement(): Promise<ElementHandle> {
    return ElementHandle.from(await this._channel.frameElement());
  }

  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: Func1<void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    return JSHandle.from(await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall })) as SmartHandle<R>;
  }

  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    return parseResult(await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall }));
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    return ElementHandle.fromNullable(await this._channel.querySelector({ selector, isPage: this._page!._isPageCall })) as ElementHandle<Element> | null;
  }

  async waitForSelector(selector: string, options: types.WaitForElementOptions = {}): Promise<ElementHandle<Element> | null> {
    return ElementHandle.fromNullable(await this._channel.waitForSelector({ selector, ...options, isPage: this._page!._isPageCall })) as ElementHandle<Element> | null;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options: types.TimeoutOptions = {}): Promise<void> {
    await this._channel.dispatchEvent({ selector, type, eventInit: serializeArgument(eventInit), ...options, isPage: this._page!._isPageCall });
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return await this._channel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall });
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return await this._channel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall });
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    const result = await this._channel.querySelectorAll({ selector, isPage: this._page!._isPageCall });
    return result.map(c => ElementHandle.from(c) as ElementHandle<Element>);
  }

  async content(): Promise<string> {
    return await this._channel.content();
  }

  async setContent(html: string, options: types.NavigateOptions = {}): Promise<void> {
    await this._channel.setContent({ html, ...options, isPage: this._page!._isPageCall });
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

  async addScriptTag(options: { url?: string, path?: string, content?: string, type?: string }): Promise<ElementHandle> {
    return ElementHandle.from(await this._channel.addScriptTag({ ...options, isPage: this._page!._isPageCall }));
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    return ElementHandle.from(await this._channel.addStyleTag({ ...options, isPage: this._page!._isPageCall }));
  }

  async click(selector: string, options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return await this._channel.click({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async dblclick(selector: string, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return await this._channel.dblclick({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async fill(selector: string, value: string, options: types.NavigatingActionWaitOptions = {}) {
    return await this._channel.fill({ selector, value, ...options, isPage: this._page!._isPageCall });
  }

  async focus(selector: string, options: types.TimeoutOptions = {}) {
    await this._channel.focus({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async textContent(selector: string, options: types.TimeoutOptions = {}): Promise<null|string> {
    return await this._channel.textContent({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async innerText(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    return await this._channel.innerText({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async innerHTML(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    return await this._channel.innerHTML({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async getAttribute(selector: string, name: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    return await this._channel.getAttribute({ selector, name, ...options, isPage: this._page!._isPageCall });
  }

  async hover(selector: string, options: types.PointerActionOptions & types.PointerActionWaitOptions = {}) {
    await this._channel.hover({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async selectOption(selector: string, values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return await this._channel.selectOption({ selector, values: convertSelectOptionValues(values), ...options, isPage: this._page!._isPageCall });
  }

  async setInputFiles(selector: string, files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    const filePayloads = await normalizeFilePayloads(files);
    await this._channel.setInputFiles({ selector, files: filePayloads.map(f => ({ name: f.name, mimeType: f.mimeType, buffer: f.buffer.toString('base64') })), ...options, isPage: this._page!._isPageCall });
  }

  async type(selector: string, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._channel.type({ selector, text, ...options, isPage: this._page!._isPageCall });
  }

  async press(selector: string, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._channel.press({ selector, key, ...options, isPage: this._page!._isPageCall });
  }

  async check(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._channel.check({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async uncheck(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._channel.uncheck({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async waitForTimeout(timeout: number) {
    await new Promise(fulfill => setTimeout(fulfill, timeout));
  }

  async waitForFunction<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>>;
  async waitForFunction<R>(pageFunction: Func1<void, R>, arg?: any, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>>;
  async waitForFunction<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg, options: types.WaitForFunctionOptions = {}): Promise<SmartHandle<R>> {
    return JSHandle.from(await this._channel.waitForFunction({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), ...options, isPage: this._page!._isPageCall })) as SmartHandle<R>;
  }

  async title(): Promise<string> {
    return await this._channel.title();
  }
}

function verifyLifecycle(waitUntil: types.LifecycleEvent): types.LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!types.kLifecycleEvents.has(waitUntil))
    throw new Error(`Unsupported waitUntil option ${String(waitUntil)}`);
  return waitUntil;
}

function waitForEvent(emitter: EventEmitter, event: string, predicate?: Function): { promise: Promise<any>, dispose: () => void } {
  let listener: (eventArg: any) => void;
  const promise = new Promise((resolve, reject) => {
    listener = (eventArg: any) => {
      try {
        if (predicate && !predicate(eventArg))
          return;
        emitter.removeListener(event, listener);
        resolve(eventArg);
      } catch (e) {
        emitter.removeListener(event, listener);
        reject(e);
      }
    };
    emitter.addListener(event, listener);
  });
  const dispose = () => emitter.removeListener(event, listener);
  return { promise, dispose };
}
