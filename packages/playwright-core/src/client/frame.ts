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

import { EventEmitter } from './eventEmitter';
import { ChannelOwner } from './channelOwner';
import { addSourceUrlToScript } from './clientHelper';
import { ElementHandle, convertInputFiles, convertSelectOptionValues } from './elementHandle';
import { Events } from './events';
import { JSHandle, assertMaxArguments, parseResult, serializeArgument } from './jsHandle';
import { FrameLocator, Locator, testIdAttributeName } from './locator';
import * as network from './network';
import { kLifecycleEvents } from './types';
import { Waiter } from './waiter';
import { assert } from '../utils/isomorphic/assert';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from '../utils/isomorphic/locatorUtils';
import { urlMatches } from '../utils/isomorphic/urlMatch';
import { TimeoutSettings } from './timeoutSettings';

import type { LocatorOptions } from './locator';
import type { Page } from './page';
import type { FilePayload, LifecycleEvent, SelectOption, SelectOptionOptions, StrictOptions, TimeoutOptions, WaitForFunctionOptions } from './types';
import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type { ByRoleOptions } from '../utils/isomorphic/locatorUtils';
import type { URLMatch } from '../utils/isomorphic/urlMatch';
import type * as channels from '@protocol/channels';

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
    this._eventEmitter = new EventEmitter(parent._platform);
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
      if (!this._parentFrame && event.add === 'load' && this._page)
        this._page.emit(Events.Page.Load, this._page);
      if (!this._parentFrame && event.add === 'domcontentloaded' && this._page)
        this._page.emit(Events.Page.DOMContentLoaded, this._page);
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

  _timeout(options?: TimeoutOptions): number {
    const timeoutSettings = this._page?._timeoutSettings || new TimeoutSettings(this._platform);
    return timeoutSettings.timeout(options || {});
  }

  _navigationTimeout(options?: TimeoutOptions): number {
    const timeoutSettings = this._page?._timeoutSettings || new TimeoutSettings(this._platform);
    return timeoutSettings.navigationTimeout(options || {});
  }

  async goto(url: string, options: channels.FrameGotoOptions & TimeoutOptions = {}): Promise<network.Response | null> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return network.Response.fromNullable((await this._channel.goto({ url, ...options, waitUntil, timeout: this._navigationTimeout(options) })).response);
  }

  private _setupNavigationWaiter(options: { timeout?: number }): Waiter {
    const waiter = new Waiter(this._page!, '');
    if (this._page!.isClosed())
      waiter.rejectImmediately(this._page!._closeErrorWithReason());
    waiter.rejectOnEvent(this._page!, Events.Page.Close, () => this._page!._closeErrorWithReason());
    waiter.rejectOnEvent(this._page!, Events.Page.Crash, new Error('Navigation failed because page crashed!'));
    waiter.rejectOnEvent<Frame>(this._page!, Events.Page.FrameDetached, new Error('Navigating frame was detached!'), frame => frame === this);
    const timeout = this._page!._timeoutSettings.navigationTimeout(options);
    waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded.`);
    return waiter;
  }

  async waitForNavigation(options: WaitForNavigationOptions = {}): Promise<network.Response | null> {
    return await this._page!._wrapApiCall(async () => {
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
    }, { title: 'Wait for navigation' });
  }

  async waitForLoadState(state: LifecycleEvent = 'load', options: { timeout?: number } = {}): Promise<void> {
    state = verifyLoadState('state', state);
    return await this._page!._wrapApiCall(async () => {
      const waiter = this._setupNavigationWaiter(options);
      if (this._loadStates.has(state)) {
        waiter.log(`  not waiting, "${state}" event already fired`);
      } else {
        await waiter.waitForEvent<LifecycleEvent>(this._eventEmitter, 'loadstate', s => {
          waiter.log(`  "${s}" event fired`);
          return s === state;
        });
      }
      waiter.dispose();
    }, { title: `Wait for load state "${state}"` });
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

  async _evaluateFunction(functionDeclaration: string) {
    const result = await this._channel.evaluateExpression({ expression: functionDeclaration, isFunction: true, arg: serializeArgument(undefined) });
    return parseResult(result.value);
  }

  async _evaluateExposeUtilityScript<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async $(selector: string, options?: { strict?: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const result = await this._channel.querySelector({ selector, ...options });
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & TimeoutOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions & TimeoutOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & TimeoutOptions = {}): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    if ((options as any).visibility)
      throw new Error('options.visibility is not supported, did you mean options.state?');
    if ((options as any).waitFor && (options as any).waitFor !== 'visible')
      throw new Error('options.waitFor is not supported, did you mean options.state?');
    const result = await this._channel.waitForSelector({ selector, ...options, timeout: this._timeout(options) });
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options: channels.FrameDispatchEventOptions & TimeoutOptions = {}): Promise<void> {
    await this._channel.dispatchEvent({ selector, type, eventInit: serializeArgument(eventInit), ...options, timeout: this._timeout(options) });
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

  async setContent(html: string, options: channels.FrameSetContentOptions & TimeoutOptions = {}): Promise<void> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    await this._channel.setContent({ html, ...options, waitUntil, timeout: this._navigationTimeout(options) });
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
      copy.content = (await this._platform.fs().promises.readFile(copy.path)).toString();
      copy.content = addSourceUrlToScript(copy.content, copy.path);
    }
    return ElementHandle.from((await this._channel.addScriptTag({ ...copy })).element);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; } = {}): Promise<ElementHandle> {
    const copy = { ...options };
    if (copy.path) {
      copy.content = (await this._platform.fs().promises.readFile(copy.path)).toString();
      copy.content += '/*# sourceURL=' + copy.path.replace(/\n/g, '') + '*/';
    }
    return ElementHandle.from((await this._channel.addStyleTag({ ...copy })).element);
  }

  async click(selector: string, options: channels.FrameClickOptions & TimeoutOptions = {}) {
    return await this._channel.click({ selector, ...options, timeout: this._timeout(options) });
  }

  async dblclick(selector: string, options: channels.FrameDblclickOptions & TimeoutOptions = {}) {
    return await this._channel.dblclick({ selector, ...options, timeout: this._timeout(options) });
  }

  async dragAndDrop(source: string, target: string, options: channels.FrameDragAndDropOptions & TimeoutOptions = {}) {
    return await this._channel.dragAndDrop({ source, target, ...options, timeout: this._timeout(options) });
  }

  async tap(selector: string, options: channels.FrameTapOptions & TimeoutOptions = {}) {
    return await this._channel.tap({ selector, ...options, timeout: this._timeout(options) });
  }

  async fill(selector: string, value: string, options: channels.FrameFillOptions & TimeoutOptions = {}) {
    return await this._channel.fill({ selector, value, ...options, timeout: this._timeout(options) });
  }

  async _highlight(selector: string) {
    return await this._channel.highlight({ selector });
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this, selector, options);
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this, selector);
  }

  async focus(selector: string, options: channels.FrameFocusOptions & TimeoutOptions = {}) {
    await this._channel.focus({ selector, ...options, timeout: this._timeout(options) });
  }

  async textContent(selector: string, options: channels.FrameTextContentOptions & TimeoutOptions = {}): Promise<null|string> {
    const value = (await this._channel.textContent({ selector, ...options, timeout: this._timeout(options) })).value;
    return value === undefined ? null : value;
  }

  async innerText(selector: string, options: channels.FrameInnerTextOptions & TimeoutOptions = {}): Promise<string> {
    return (await this._channel.innerText({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async innerHTML(selector: string, options: channels.FrameInnerHTMLOptions & TimeoutOptions = {}): Promise<string> {
    return (await this._channel.innerHTML({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async getAttribute(selector: string, name: string, options: channels.FrameGetAttributeOptions & TimeoutOptions = {}): Promise<string | null> {
    const value = (await this._channel.getAttribute({ selector, name, ...options, timeout: this._timeout(options) })).value;
    return value === undefined ? null : value;
  }

  async inputValue(selector: string, options: channels.FrameInputValueOptions & TimeoutOptions = {}): Promise<string> {
    return (await this._channel.inputValue({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async isChecked(selector: string, options: channels.FrameIsCheckedOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isChecked({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async isDisabled(selector: string, options: channels.FrameIsDisabledOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isDisabled({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async isEditable(selector: string, options: channels.FrameIsEditableOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isEditable({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async isEnabled(selector: string, options: channels.FrameIsEnabledOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isEnabled({ selector, ...options, timeout: this._timeout(options) })).value;
  }

  async isHidden(selector: string, options: channels.FrameIsHiddenOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isHidden({ selector, ...options })).value;
  }

  async isVisible(selector: string, options: channels.FrameIsVisibleOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isVisible({ selector, ...options })).value;
  }

  async hover(selector: string, options: channels.FrameHoverOptions & TimeoutOptions = {}) {
    await this._channel.hover({ selector, ...options, timeout: this._timeout(options) });
  }

  async selectOption(selector: string, values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions & StrictOptions = {}): Promise<string[]> {
    return (await this._channel.selectOption({ selector, ...convertSelectOptionValues(values), ...options, timeout: this._timeout(options) })).values;
  }

  async setInputFiles(selector: string, files: string | FilePayload | string[] | FilePayload[], options: channels.FrameSetInputFilesOptions & TimeoutOptions = {}): Promise<void> {
    const converted = await convertInputFiles(this._platform, files, this.page().context());
    await this._channel.setInputFiles({ selector, ...converted, ...options, timeout: this._timeout(options) });
  }

  async type(selector: string, text: string, options: channels.FrameTypeOptions & TimeoutOptions = {}) {
    await this._channel.type({ selector, text, ...options, timeout: this._timeout(options) });
  }

  async press(selector: string, key: string, options: channels.FramePressOptions & TimeoutOptions = {}) {
    await this._channel.press({ selector, key, ...options, timeout: this._timeout(options) });
  }

  async check(selector: string, options: channels.FrameCheckOptions & TimeoutOptions = {}) {
    await this._channel.check({ selector, ...options, timeout: this._timeout(options) });
  }

  async uncheck(selector: string, options: channels.FrameUncheckOptions & TimeoutOptions = {}) {
    await this._channel.uncheck({ selector, ...options, timeout: this._timeout(options) });
  }

  async setChecked(selector: string, checked: boolean, options?: channels.FrameCheckOptions) {
    if (checked)
      await this.check(selector, options);
    else
      await this.uncheck(selector, options);
  }

  async waitForTimeout(timeout: number) {
    await this._channel.waitForTimeout({ waitTimeout: timeout });
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
      timeout: this._timeout(options),
    });
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }

  async title(): Promise<string> {
    return (await this._channel.title()).value;
  }

  async _expect(expression: string, options: Omit<channels.FrameExpectParams, 'expression'>): Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }> {
    const params: channels.FrameExpectParams = { expression, ...options, isNot: !!options.isNot };
    params.expectedValue = serializeArgument(options.expectedValue);
    const result = (await this._channel.expect(params));
    if (result.received !== undefined)
      result.received = parseResult(result.received);
    return result;
  }
}

export function verifyLoadState(name: string, waitUntil: LifecycleEvent): LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!kLifecycleEvents.has(waitUntil))
    throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle|commit)`);
  return waitUntil;
}
