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

import { assert } from '../utils';
import type * as channels from '../protocol/channels';
import { ChannelOwner } from './channelOwner';
import { FrameLocator, Locator, type LocatorOptions } from './locator';
import { ElementHandle, convertSelectOptionValues, convertInputFiles } from './elementHandle';
import { assertMaxArguments, JSHandle, serializeArgument, parseResult } from './jsHandle';
import fs from 'fs';
import * as network from './network';
import type { Page } from './page';
import { EventEmitter } from 'events';
import { Waiter } from './waiter';
import { Events } from './events';
import type { LifecycleEvent, URLMatch, SelectOption, SelectOptionOptions, FilePayload, WaitForFunctionOptions, StrictOptions } from './types';
import { kLifecycleEvents } from './types';
import { urlMatches } from './clientHelper';
import type * as api from '../../types/types';
import type * as structs from '../../types/structs';
import { debugLogger } from '../common/debugLogger';

export type WaitForNavigationOptions = {
  timeout?: number,
  waitUntil?: LifecycleEvent,
  url?: URLMatch,
};

export class Frame extends ChannelOwner<channels.FrameChannel> implements api.Frame {
  _eventEmitter: EventEmitter;
  _loadStates: Set<LifecycleEvent>;
  _parentFrame: Frame | null = null;
  _url = '';
  _name = '';
  _detached = false;
  _childFrames = new Set<Frame>();
  _page: Page | undefined;

  static from(frame: channels.FrameChannel): Frame {
    return (frame as any)._object;
  }

  static fromNullable(frame: channels.FrameChannel | undefined): Frame | null {
    return frame ? Frame.from(frame) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.FrameInitializer) {
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
    this._channel.on('navigated', event => {
      this._url = event.url;
      this._name = event.name;
      this._eventEmitter.emit('navigated', event);
      if (!event.error && this._page)
        this._page.emit(Events.Page.FrameNavigated, this);
    });
  }

  page(): Page {
    return this._page!;
  }

  async goto(url: string, options: channels.FrameGotoOptions = {}): Promise<network.Response | null> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return network.Response.fromNullable((await this._channel.goto({ url, ...options, waitUntil })).response);
  }

  private _setupNavigationWaiter(options: { timeout?: number }): Waiter {
    const waiter = new Waiter(this._page!, '');
    if (this._page!.isClosed())
      waiter.rejectImmediately(new Error('Navigation failed because page was closed!'));
    waiter.rejectOnEvent(this._page!, Events.Page.Close, new Error('Navigation failed because page was closed!'));
    waiter.rejectOnEvent(this._page!, Events.Page.Crash, new Error('Navigation failed because page crashed!'));
    waiter.rejectOnEvent<Frame>(this._page!, Events.Page.FrameDetached, new Error('Navigating frame was detached!'), frame => frame === this);
    const timeout = this._page!._timeoutSettings.navigationTimeout(options);
    waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded.`);
    return waiter;
  }

  async waitForNavigation(options: WaitForNavigationOptions = {}): Promise<network.Response | null> {
    return this._page!._wrapApiCall(async () => {
      const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
      const waiter = this._setupNavigationWaiter(options);

      const toUrl = typeof options.url === 'string' ? ` to "${options.url}"` : '';
      waiter.log(`waiting for navigation${toUrl} until "${waitUntil}"`);

      const navigatedEvent = await waiter.waitForEvent<channels.FrameNavigatedEvent>(this._eventEmitter, 'navigated', event => {
        // Any failed navigation results in a rejection.
        if (event.error)
          return true;
        waiter.log(`  navigated to "${event.url}"`);
        return urlMatches(this._page?.context()._options.baseURL, event.url, options.url);
      });
      if (navigatedEvent.error) {
        const e = new Error(navigatedEvent.error);
        e.stack = '';
        await waiter.waitForPromise(Promise.reject(e));
      }

      if (!this._loadStates.has(waitUntil)) {
        await waiter.waitForEvent<LifecycleEvent>(this._eventEmitter, 'loadstate', s => {
          waiter.log(`  "${s}" event fired`);
          return s === waitUntil;
        });
      }

      const request = navigatedEvent.newDocument ? network.Request.fromNullable(navigatedEvent.newDocument.request) : null;
      const response = request ? await waiter.waitForPromise(request._finalRequest()._internalResponse()) : null;
      waiter.dispose();
      return response;
    });
  }

  async waitForLoadState(state: LifecycleEvent = 'load', options: { timeout?: number } = {}): Promise<void> {
    state = verifyLoadState('state', state);
    if (this._loadStates.has(state))
      return;
    return this._page!._wrapApiCall(async () => {
      const waiter = this._setupNavigationWaiter(options);
      await waiter.waitForEvent<LifecycleEvent>(this._eventEmitter, 'loadstate', s => {
        waiter.log(`  "${s}" event fired`);
        return s === state;
      });
      waiter.dispose();
    });
  }

  async waitForURL(url: URLMatch, options: { waitUntil?: LifecycleEvent, timeout?: number } = {}): Promise<void> {
    if (urlMatches(this._page?.context()._options.baseURL, this.url(), url))
      return await this.waitForLoadState(options.waitUntil, options);

    await this.waitForNavigation({ url, ...options });
  }

  async frameElement(): Promise<ElementHandle> {
    return ElementHandle.from((await this._channel.frameElement()).element);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<structs.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async $(selector: string, options?: { strict?: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const result = await this._channel.querySelector({ selector, ...options });
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions = {}): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    if ((options as any).visibility)
      throw new Error('options.visibility is not supported, did you mean options.state?');
    if ((options as any).waitFor && (options as any).waitFor !== 'visible')
      throw new Error('options.waitFor is not supported, did you mean options.state?');
    const result = await this._channel.waitForSelector({ selector, ...options });
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options: channels.FrameDispatchEventOptions = {}): Promise<void> {
    await this._channel.dispatchEvent({ selector, type, eventInit: serializeArgument(eventInit), ...options });
  }

  async $eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element, Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const result = await this._channel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async $$eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const result = await this._channel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]> {
    const result = await this._channel.querySelectorAll({ selector });
    return result.elements.map(e => ElementHandle.from(e) as ElementHandle<SVGElement | HTMLElement>);
  }

  async _queryCount(selector: string): Promise<number> {
    return (await this._channel.queryCount({ selector })).value;
  }

  async content(): Promise<string> {
    return (await this._channel.content()).value;
  }

  async setContent(html: string, options: channels.FrameSetContentOptions = {}): Promise<void> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    await this._channel.setContent({ html, ...options, waitUntil });
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

  async addScriptTag(options: { url?: string, path?: string, content?: string, type?: string } = {}): Promise<ElementHandle> {
    const copy = { ...options };
    if (copy.path) {
      copy.content = (await fs.promises.readFile(copy.path)).toString();
      copy.content += '//# sourceURL=' + copy.path.replace(/\n/g, '');
    }
    return ElementHandle.from((await this._channel.addScriptTag({ ...copy })).element);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; } = {}): Promise<ElementHandle> {
    const copy = { ...options };
    if (copy.path) {
      copy.content = (await fs.promises.readFile(copy.path)).toString();
      copy.content += '/*# sourceURL=' + copy.path.replace(/\n/g, '') + '*/';
    }
    return ElementHandle.from((await this._channel.addStyleTag({ ...copy })).element);
  }

  async click(selector: string, options: channels.FrameClickOptions = {}) {
    return await this._channel.click({ selector, ...options });
  }

  async dblclick(selector: string, options: channels.FrameDblclickOptions = {}) {
    return await this._channel.dblclick({ selector, ...options });
  }

  async dragAndDrop(source: string, target: string, options: channels.FrameDragAndDropOptions = {}) {
    return await this._channel.dragAndDrop({ source, target, ...options });
  }

  async tap(selector: string, options: channels.FrameTapOptions = {}) {
    return await this._channel.tap({ selector, ...options });
  }

  async fill(selector: string, value: string, options: channels.FrameFillOptions = {}) {
    return await this._channel.fill({ selector, value, ...options });
  }

  async _highlight(selector: string) {
    return await this._channel.highlight({ selector });
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this, selector, options);
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this, selector);
  }

  async focus(selector: string, options: channels.FrameFocusOptions = {}) {
    await this._channel.focus({ selector, ...options });
  }

  async textContent(selector: string, options: channels.FrameTextContentOptions = {}): Promise<null|string> {
    const value = (await this._channel.textContent({ selector, ...options })).value;
    return value === undefined ? null : value;
  }

  async innerText(selector: string, options: channels.FrameInnerTextOptions = {}): Promise<string> {
    return (await this._channel.innerText({ selector, ...options })).value;
  }

  async innerHTML(selector: string, options: channels.FrameInnerHTMLOptions = {}): Promise<string> {
    return (await this._channel.innerHTML({ selector, ...options })).value;
  }

  async getAttribute(selector: string, name: string, options: channels.FrameGetAttributeOptions = {}): Promise<string | null> {
    const value = (await this._channel.getAttribute({ selector, name, ...options })).value;
    return value === undefined ? null : value;
  }

  async inputValue(selector: string, options: channels.FrameInputValueOptions = {}): Promise<string> {
    return (await this._channel.inputValue({ selector, ...options })).value;
  }

  async isChecked(selector: string, options: channels.FrameIsCheckedOptions = {}): Promise<boolean> {
    return (await this._channel.isChecked({ selector, ...options })).value;
  }

  async isDisabled(selector: string, options: channels.FrameIsDisabledOptions = {}): Promise<boolean> {
    return (await this._channel.isDisabled({ selector, ...options })).value;
  }

  async isEditable(selector: string, options: channels.FrameIsEditableOptions = {}): Promise<boolean> {
    return (await this._channel.isEditable({ selector, ...options })).value;
  }

  async isEnabled(selector: string, options: channels.FrameIsEnabledOptions = {}): Promise<boolean> {
    return (await this._channel.isEnabled({ selector, ...options })).value;
  }

  async isHidden(selector: string, options: channels.FrameIsHiddenOptions = {}): Promise<boolean> {
    return (await this._channel.isHidden({ selector, ...options })).value;
  }

  async isVisible(selector: string, options: channels.FrameIsVisibleOptions = {}): Promise<boolean> {
    return (await this._channel.isVisible({ selector, ...options })).value;
  }

  async hover(selector: string, options: channels.FrameHoverOptions = {}) {
    await this._channel.hover({ selector, ...options });
  }

  async selectOption(selector: string, values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions & StrictOptions = {}): Promise<string[]> {
    return (await this._channel.selectOption({ selector, ...convertSelectOptionValues(values), ...options })).values;
  }

  async setInputFiles(selector: string, files: string | FilePayload | string[] | FilePayload[], options: channels.FrameSetInputFilesOptions = {}): Promise<void> {
    const converted = await convertInputFiles(files, this.page().context());
    if (converted.files) {
      await this._channel.setInputFiles({ selector, files: converted.files, ...options });
    } else {
      debugLogger.log('api', 'switching to large files mode');
      await this._channel.setInputFilePaths({ selector, ...converted, ...options });
    }
  }

  async type(selector: string, text: string, options: channels.FrameTypeOptions = {}) {
    await this._channel.type({ selector, text, ...options });
  }

  async press(selector: string, key: string, options: channels.FramePressOptions = {}) {
    await this._channel.press({ selector, key, ...options });
  }

  async check(selector: string, options: channels.FrameCheckOptions = {}) {
    await this._channel.check({ selector, ...options });
  }

  async uncheck(selector: string, options: channels.FrameUncheckOptions = {}) {
    await this._channel.uncheck({ selector, ...options });
  }

  async setChecked(selector: string, checked: boolean, options?: channels.FrameCheckOptions) {
    if (checked)
      await this.check(selector, options);
    else
      await this.uncheck(selector, options);
  }

  async waitForTimeout(timeout: number) {
    await this._channel.waitForTimeout({ timeout });
  }

  async waitForFunction<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg, options: WaitForFunctionOptions = {}): Promise<structs.SmartHandle<R>> {
    if (typeof options.polling === 'string')
      assert(options.polling === 'raf', 'Unknown polling option: ' + options.polling);
    const result = await this._channel.waitForFunction({
      ...options,
      pollingInterval: options.polling === 'raf' ? undefined : options.polling,
      expression: String(pageFunction),
      isFunction: typeof pageFunction === 'function',
      arg: serializeArgument(arg),
    });
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }

  async title(): Promise<string> {
    return (await this._channel.title()).value;
  }
}

export function verifyLoadState(name: string, waitUntil: LifecycleEvent): LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!kLifecycleEvents.has(waitUntil))
    throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle|commit)`);
  return waitUntil;
}
