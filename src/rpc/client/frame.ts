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
import { ElementHandle, convertSelectOptionValues } from './elementHandle';
import { JSHandle, Func1, FuncOn, SmartHandle, convertArg } from './jsHandle';
import * as network from './network';
import { Response } from './network';
import { Page } from './page';
import { Connection } from '../connection';

export type GotoOptions = types.NavigateOptions & {
  referer?: string,
};

export type FunctionWithSource = (source: { context: BrowserContext, page: Page, frame: Frame }, ...args: any) => any;

export class Frame extends ChannelOwner<FrameChannel, FrameInitializer> {
  _parentFrame: Frame | null = null;
  _url = '';
  _name = '';
  private _detached = false;
  _childFrames = new Set<Frame>();
  _page: Page | undefined;

  static from(frame: FrameChannel): Frame {
    return frame._object;
  }

  static fromNullable(frame: FrameChannel | null): Frame | null {
    return frame ? Frame.from(frame) : null;
  }

  constructor(connection: Connection, channel: FrameChannel, initializer: FrameInitializer) {
    super(connection, channel, initializer);
    this._parentFrame = Frame.fromNullable(initializer.parentFrame);
    if (this._parentFrame)
      this._parentFrame._childFrames.add(this);
    this._name = initializer.name;
    this._url = initializer.url;
  }

  async goto(url: string, options: GotoOptions = {}): Promise<network.Response | null> {
    return Response.fromNullable(await this._channel.goto({ url, options }));
  }

  async waitForNavigation(options: types.WaitForNavigationOptions = {}): Promise<network.Response | null> {
    return Response.fromNullable(await this._channel.waitForNavigation({ options }));
  }

  async waitForLoadState(state: types.LifecycleEvent = 'load', options: types.TimeoutOptions = {}): Promise<void> {
    await this._channel.waitForLoadState({ state, options });
  }

  async frameElement(): Promise<ElementHandle> {
    return ElementHandle.from(await this._channel.frameElement());
  }

  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: Func1<void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    return JSHandle.from(await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: convertArg(arg) })) as SmartHandle<R>;
  }

  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    return await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: convertArg(arg) });
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    return ElementHandle.fromNullable(await this._channel.querySelector({ selector })) as ElementHandle<Element> | null;
  }

  async waitForSelector(selector: string, options: types.WaitForElementOptions = {}): Promise<ElementHandle<Element> | null> {
    return ElementHandle.fromNullable(await this._channel.waitForSelector({ selector, options })) as ElementHandle<Element> | null;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: Object, options: types.TimeoutOptions = {}): Promise<void> {
    await this._channel.dispatchEvent({ selector, type, eventInit, options });
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return await this._channel.$eval({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: convertArg(arg) });
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    return await this._channel.$$eval({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: convertArg(arg) });
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    const result = await this._channel.querySelectorAll({ selector });
    return result.map(c => ElementHandle.from(c) as ElementHandle<Element>);
  }

  async content(): Promise<string> {
    return await this._channel.content();
  }

  async setContent(html: string, options: types.NavigateOptions = {}): Promise<void> {
    await this._channel.setContent({ html, options });
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
    return ElementHandle.from(await this._channel.addScriptTag({ options }));
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; }): Promise<ElementHandle> {
    return ElementHandle.from(await this._channel.addStyleTag({ options }));
  }

  async click(selector: string, options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return await this._channel.click({ selector, options });
  }

  async dblclick(selector: string, options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return await this._channel.dblclick({ selector, options });
  }

  async fill(selector: string, value: string, options: types.NavigatingActionWaitOptions = {}) {
    return await this._channel.fill({ selector, value, options });
  }

  async focus(selector: string, options: types.TimeoutOptions = {}) {
    await this._channel.focus({ selector, options });
  }

  async textContent(selector: string, options: types.TimeoutOptions = {}): Promise<null|string> {
    return await this._channel.textContent({ selector, options });
  }

  async innerText(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    return await this._channel.innerText({ selector, options });
  }

  async innerHTML(selector: string, options: types.TimeoutOptions = {}): Promise<string> {
    return await this._channel.innerHTML({ selector, options });
  }

  async getAttribute(selector: string, name: string, options: types.TimeoutOptions = {}): Promise<string | null> {
    return await this._channel.getAttribute({ selector, name, options });
  }

  async hover(selector: string, options: types.PointerActionOptions & types.PointerActionWaitOptions = {}) {
    await this._channel.hover({ selector, options });
  }

  async selectOption(selector: string, values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return await this._channel.selectOption({ selector, values: convertSelectOptionValues(values), options });
  }

  async setInputFiles(selector: string, files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    await this._channel.setInputFiles({ selector, files, options });
  }

  async type(selector: string, text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._channel.type({ selector, text, options });
  }

  async press(selector: string, key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}) {
    await this._channel.press({ selector, key, options });
  }

  async check(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._channel.check({ selector, options });
  }

  async uncheck(selector: string, options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    await this._channel.uncheck({ selector, options });
  }

  async waitForTimeout(timeout: number) {
    await new Promise(fulfill => setTimeout(fulfill, timeout));
  }

  async waitForFunction<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>>;
  async waitForFunction<R>(pageFunction: Func1<void, R>, arg?: any, options?: types.WaitForFunctionOptions): Promise<SmartHandle<R>>;
  async waitForFunction<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg, options: types.WaitForFunctionOptions = {}): Promise<SmartHandle<R>> {
    return JSHandle.from(await this._channel.waitForFunction({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg, options })) as SmartHandle<R>;
  }

  async title(): Promise<string> {
    return await this._channel.title();
  }
}
