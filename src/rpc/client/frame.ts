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

import { assertMaxArguments } from '../../helper';
import * as types from '../../types';
import { FrameChannel, FrameInitializer } from '../channels';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { ElementHandle, convertSelectOptionValues, convertInputFiles } from './elementHandle';
import { JSHandle, Func1, FuncOn, SmartHandle, serializeArgument, parseResult } from './jsHandle';
import * as fs from 'fs';
import * as network from './network';
import * as util from 'util';
import { Page } from './page';
import { EventEmitter } from 'events';
import { Waiter } from './waiter';
import { Events } from '../../events';
import { TimeoutError } from '../../errors';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

export type GotoOptions = types.NavigateOptions & {
  referer?: string,
};

export type FunctionWithSource = (source: { context: BrowserContext, page: Page, frame: Frame }, ...args: any) => any;

export class Frame extends ChannelOwner<FrameChannel, FrameInitializer> {
  _eventEmitter: EventEmitter;
  _loadStates: Set<types.LifecycleEvent>;
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

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: FrameInitializer) {
    super(parent, type, guid, initializer);
    this._eventEmitter = new EventEmitter();
    this._eventEmitter.setMaxListeners(0);
    this._parentFrame = Frame.fromNullable(initializer.parentFrame);
    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
    this._name = initializer.name;
    this._url = initializer.url;
    this._loadStates = new Set(initializer.loadStates);
    this._channel.on('loadstate', event => {
      if (event.add) {
        this._loadStates.add(event.add);
        this._eventEmitter.emit('loadstate', event.add);
      }
      if (event.remove)
        this._loadStates.delete(event.remove);
    });
  }

  async goto(url: string, options: GotoOptions = {}): Promise<network.Response | null> {
    return network.Response.fromNullable((await this._channel.goto({ url, ...options, isPage: this._page!._isPageCall })).response);
  }

  async waitForNavigation(options: types.WaitForNavigationOptions = {}): Promise<network.Response | null> {
    return network.Response.fromNullable((await this._channel.waitForNavigation({ ...options, isPage: this._page!._isPageCall })).response);
  }

  async waitForLoadState(state: types.LifecycleEvent = 'load', options: types.TimeoutOptions = {}): Promise<void> {
    state = verifyLoadState(state);
    if (this._loadStates.has(state))
      return;
    const timeout = this._page!._timeoutSettings.navigationTimeout(options);
    const apiName = this._page!._isPageCall ? 'page.waitForLoadState' : 'frame.waitForLoadState';
    const waiter = new Waiter();
    waiter.rejectOnEvent(this._page!, Events.Page.Close, new Error('Navigation failed because page was closed!'));
    waiter.rejectOnEvent(this._page!, Events.Page.Crash, new Error('Navigation failed because page crashed!'));
    waiter.rejectOnEvent<Frame>(this._page!, Events.Page.FrameDetached, new Error('Navigating frame was detached!'), frame => frame === this);
    waiter.rejectOnTimeout(timeout, new TimeoutError(`Timeout ${timeout}ms exceeded during ${apiName}.`));
    await waiter.waitForEvent<types.LifecycleEvent>(this._eventEmitter, 'loadstate', s => s === state);
    waiter.dispose();
  }

  async frameElement(): Promise<ElementHandle> {
    return ElementHandle.from((await this._channel.frameElement()).element);
  }

  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: Func1<void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall });
    return JSHandle.from(result.handle) as SmartHandle<R>;
  }

  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall });
    return parseResult(result.value);
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    const result = await this._channel.querySelector({ selector, isPage: this._page!._isPageCall });
    return ElementHandle.fromNullable(result.element) as ElementHandle<Element> | null;
  }

  async waitForSelector(selector: string, options: types.WaitForElementOptions = {}): Promise<ElementHandle<Element> | null> {
    const result = await this._channel.waitForSelector({ selector, ...options, isPage: this._page!._isPageCall });
    return ElementHandle.fromNullable(result.element) as ElementHandle<Element> | null;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options: types.TimeoutOptions = {}): Promise<void> {
    await this._channel.dispatchEvent({ selector, type, eventInit: serializeArgument(eventInit), ...options, isPage: this._page!._isPageCall });
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const result = await this._channel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall });
    return parseResult(result.value);
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const result = await this._channel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), isPage: this._page!._isPageCall });
    return parseResult(result.value);
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    const result = await this._channel.querySelectorAll({ selector, isPage: this._page!._isPageCall });
    return result.elements.map(e => ElementHandle.from(e) as ElementHandle<Element>);
  }

  async content(): Promise<string> {
    return (await this._channel.content()).value;
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
    const copy = { ...options };
    if (copy.path) {
      copy.content = (await fsReadFileAsync(copy.path)).toString();
      copy.content += '//# sourceURL=' + copy.path.replace(/\n/g, '');
    }
    return ElementHandle.from((await this._channel.addScriptTag({ ...copy, isPage: this._page!._isPageCall })).element);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    const copy = { ...options };
    if (copy.path)
      copy.content = (await fsReadFileAsync(copy.path)).toString();
    return ElementHandle.from((await this._channel.addStyleTag({ ...options, isPage: this._page!._isPageCall })).element);
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
    return (await this._channel.textContent({ selector, ...options, isPage: this._page!._isPageCall })).value;
  }

  async innerText(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    return (await this._channel.innerText({ selector, ...options, isPage: this._page!._isPageCall })).value;
  }

  async innerHTML(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    return (await this._channel.innerHTML({ selector, ...options, isPage: this._page!._isPageCall })).value;
  }

  async getAttribute(selector: string, name: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    return (await this._channel.getAttribute({ selector, name, ...options, isPage: this._page!._isPageCall })).value;
  }

  async hover(selector: string, options: types.PointerActionOptions & types.PointerActionWaitOptions = {}) {
    await this._channel.hover({ selector, ...options, isPage: this._page!._isPageCall });
  }

  async selectOption(selector: string, values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return (await this._channel.selectOption({ selector, ...convertSelectOptionValues(values), ...options, isPage: this._page!._isPageCall })).values;
  }

  async setInputFiles(selector: string, files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    await this._channel.setInputFiles({ selector, files: await convertInputFiles(files), ...options, isPage: this._page!._isPageCall });
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
    const result = await this._channel.waitForFunction({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg), ...options, isPage: this._page!._isPageCall });
    return JSHandle.from(result.handle) as SmartHandle<R>;
  }

  async title(): Promise<string> {
    return (await this._channel.title()).value;
  }
}

function verifyLoadState(waitUntil: types.LifecycleEvent): types.LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!types.kLifecycleEvents.has(waitUntil))
    throw new Error(`Unsupported waitUntil option ${String(waitUntil)}`);
  return waitUntil;
}
