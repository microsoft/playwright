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

import fs from 'fs';

import { assertionAbortedMessage } from '@isomorphic/abortSignal';
import { assert } from '@isomorphic/assert';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from '@isomorphic/locatorUtils';
import { urlMatches } from '@isomorphic/urlMatch';
import { EventEmitter } from './eventEmitter';
import { ChannelOwner } from './channelOwner';
import { addSourceUrlToScript } from './clientHelper';
import { ElementHandle, convertInputFiles, convertSelectOptionValues } from './elementHandle';
import { AbortError, PlaywrightError } from './errors';
import { Events } from './events';
import { JSHandle, assertEvaluateOptions, assertMaxArguments, parseResult, serializeArgument, serializeArgumentWithCallbacks } from './jsHandle';
import { FrameLocator, kPierceFramesSelector, Locator, testIdAttributeName } from './locator';
import * as network from './network';
import { kLifecycleEvents } from './types';
import { Waiter } from './waiter';
import { TimeoutSettings, kNoTimeout } from './timeoutSettings';

import type { EvaluateOptions } from './jsHandle';
import type { LocatorOptions } from './locator';
import type { Page } from './page';
import type { DropPayload, FilePayload, LifecycleEvent, SelectOption, SelectOptionOptions, StrictOptions, TimeoutOptions, WaitForFunctionOptions } from './types';
import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type { ByRoleOptions } from '@isomorphic/locatorUtils';
import type { URLMatch } from '@isomorphic/urlMatch';
import type * as channels from './channels';

export type WaitForNavigationOptions = {
  timeout?: number,
  waitUntil?: LifecycleEvent,
  url?: URLMatch,
  signal?: AbortSignal,
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
      if (!this._parentFrame && event.add === 'load' && this._page) {
        this._page.emit(Events.Page.Load, this._page);
        this._page.context().emit(Events.BrowserContext.PageLoad, this._page);
      }
      if (!this._parentFrame && event.add === 'domcontentloaded' && this._page)
        this._page.emit(Events.Page.DOMContentLoaded, this._page);
    });
    this._channel.on('navigated', event => {
      this._url = event.url;
      this._name = event.name;
      // Main frame navigation destroys all execution contexts in the page,
      // erase the bindings backing the functions passed to evaluate().
      if (!this._parentFrame && event.newDocument && this._page)
        this._page._eraseEvaluateCallbacks();
      this._eventEmitter.emit('navigated', event);
      if (!event.error && this._page) {
        this._page.emit(Events.Page.FrameNavigated, this);
        this._page.context().emit(Events.BrowserContext.FrameNavigated, this);
      }
    });
  }

  page(): Page {
    return this._page!;
  }

  _timeout(options?: TimeoutOptions): channels.TimeoutOptions {
    const timeoutSettings = this._page?._timeoutSettings || new TimeoutSettings();
    return timeoutSettings.timeout(options || {});
  }

  _navigationTimeout(options?: TimeoutOptions): channels.TimeoutOptions {
    const timeoutSettings = this._page?._timeoutSettings || new TimeoutSettings();
    return timeoutSettings.navigationTimeout(options || {});
  }

  async goto(url: string, options: channels.FrameGotoOptions & TimeoutOptions = {}): Promise<network.Response | null> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return network.Response.fromNullable((await this._channel.goto({ url, ...options, waitUntil }, this._navigationTimeout(options))).response);
  }

  private _setupNavigationWaiter(options: TimeoutOptions): Waiter {
    const waiter = new Waiter(this._page!, '');
    if (this._page!.isClosed())
      waiter.rejectImmediately(this._page!._closeErrorWithReason());
    waiter.rejectOnEvent(this._page!, Events.Page.Close, () => this._page!._closeErrorWithReason());
    waiter.rejectOnEvent(this._page!, Events.Page.Crash, new Error('Navigation failed because page crashed!'));
    waiter.rejectOnEvent<Frame>(this._page!, Events.Page.FrameDetached, new Error('Navigating frame was detached!'), frame => frame === this);
    const timeoutOptions = this._page!._timeoutSettings.navigationTimeout(options);
    waiter.rejectOnTimeout(timeoutOptions, `Timeout ${timeoutOptions.timeout}ms exceeded.`);
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

  async waitForLoadState(state: LifecycleEvent = 'load', options?: TimeoutOptions): Promise<void> {
    state = verifyLoadState('state', state);
    return await this._page!._wrapApiCall(async () => {
      const waiter = this._setupNavigationWaiter(options ?? {});
      try {
        if (this._loadStates.has(state)) {
          waiter.log(`  not waiting, "${state}" event already fired`);
          waiter.throwIfImmediatelyRejected();
        } else {
          await waiter.waitForEvent<LifecycleEvent>(this._eventEmitter, 'loadstate', s => {
            waiter.log(`  "${s}" event fired`);
            return s === state;
          });
        }
      } finally {
        waiter.dispose();
      }
    }, { title: `Wait for load state "${state}"` });
  }

  async waitForURL(url: URLMatch, options?: { waitUntil?: LifecycleEvent } & TimeoutOptions): Promise<void> {
    const waitOptions = options ?? {};
    if (urlMatches(this._page?.context()._options.baseURL, this.url(), url))
      return await this.waitForLoadState(waitOptions.waitUntil, waitOptions);

    await this.waitForNavigation({ url, ...waitOptions });
  }

  async frameElement(): Promise<ElementHandle> {
    return ElementHandle.from((await this._channel.frameElement({}, kNoTimeout)).element);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg, options?: EvaluateOptions): Promise<structs.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 3);
    assertEvaluateOptions(options);
    const serializedArg = options?.exposeFunctions ? await serializeArgumentWithCallbacks(this, this._page, arg) : serializeArgument(arg);
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializedArg }, kNoTimeout);
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg, options?: EvaluateOptions): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    assertEvaluateOptions(options);
    const serializedArg = options?.exposeFunctions ? await serializeArgumentWithCallbacks(this, this._page, arg) : serializeArgument(arg);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializedArg }, kNoTimeout);
    return parseResult(result.value);
  }

  async _evaluateExposeUtilityScript<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) }, kNoTimeout);
    return parseResult(result.value);
  }

  async $(selector: string, options?: { strict?: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const result = await this._channel.querySelector({ selector, ...options }, kNoTimeout);
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & TimeoutOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.FrameWaitForSelectorOptions & TimeoutOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options: channels.FrameWaitForSelectorOptions & TimeoutOptions = {}): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    if ((options as any).visibility)
      throw new Error('options.visibility is not supported, did you mean options.state?');
    if ((options as any).waitFor && (options as any).waitFor !== 'visible')
      throw new Error('options.waitFor is not supported, did you mean options.state?');
    const result = await this._channel.waitForSelector({ selector, ...options }, this._timeout(options));
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  async dispatchEvent(selector: string, type: string, eventInit?: any, options: channels.FrameDispatchEventOptions & TimeoutOptions = {}): Promise<void> {
    await this._channel.dispatchEvent({ selector, type, eventInit: serializeArgument(eventInit), ...options }, this._timeout(options));
  }

  async $eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element, Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const result = await this._channel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) }, kNoTimeout);
    return parseResult(result.value);
  }

  async $$eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 3);
    const result = await this._channel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) }, kNoTimeout);
    return parseResult(result.value);
  }

  async $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]> {
    const result = await this._channel.querySelectorAll({ selector }, kNoTimeout);
    return result.elements.map(e => ElementHandle.from(e) as ElementHandle<SVGElement | HTMLElement>);
  }

  async _queryCount(selector: string): Promise<number> {
    return (await this._channel.queryCount({ selector }, kNoTimeout)).value;
  }

  async content(): Promise<string> {
    return (await this._channel.content({}, kNoTimeout)).value;
  }

  async setContent(html: string, options: channels.FrameSetContentOptions & TimeoutOptions = {}): Promise<void> {
    const waitUntil = verifyLoadState('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    await this._channel.setContent({ html, ...options, waitUntil }, this._navigationTimeout(options));
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
      copy.content = addSourceUrlToScript(copy.content, copy.path);
    }
    return ElementHandle.from((await this._channel.addScriptTag({ ...copy }, kNoTimeout)).element);
  }

  async addStyleTag(options: { url?: string; path?: string; content?: string; } = {}): Promise<ElementHandle> {
    const copy = { ...options };
    if (copy.path) {
      copy.content = (await fs.promises.readFile(copy.path)).toString();
      copy.content += '/*# sourceURL=' + copy.path.replace(/\n/g, '') + '*/';
    }
    return ElementHandle.from((await this._channel.addStyleTag({ ...copy }, kNoTimeout)).element);
  }

  async click(selector: string, options: channels.FrameClickOptions & TimeoutOptions = {}) {
    return await this._channel.click({ selector, ...options }, this._timeout(options));
  }

  async dblclick(selector: string, options: channels.FrameDblclickOptions & TimeoutOptions = {}) {
    return await this._channel.dblclick({ selector, ...options }, this._timeout(options));
  }

  async dragAndDrop(source: string, target: string, options: channels.FrameDragAndDropOptions & TimeoutOptions = {}) {
    return await this._channel.dragAndDrop({ source, target, ...options }, this._timeout(options));
  }

  async _drop(selector: string, payload: DropPayload, options: Omit<channels.FrameDropOptions, 'payloads' | 'localPaths' | 'streams' | 'data'> & TimeoutOptions = {}) {
    let fileParams: { payloads?: channels.FrameDropParams['payloads'], localPaths?: string[], streams?: channels.FrameDropParams['streams'] } = {};
    if (payload.files !== undefined) {
      const converted = await convertInputFiles(payload.files, this.page().context());
      if (converted.localDirectory || converted.directoryStream)
        throw new Error('Dropping a directory is not supported — pass individual files.');
      fileParams = { payloads: converted.payloads, localPaths: converted.localPaths, streams: converted.streams };
    }
    const dataArray = payload.data ? Object.entries(payload.data).map(([mimeType, value]) => ({ mimeType, value })) : undefined;
    await this._channel.drop({
      selector,
      ...fileParams,
      data: dataArray,
      ...options,
    }, this._timeout(options));
  }

  async tap(selector: string, options: channels.FrameTapOptions & TimeoutOptions = {}) {
    return await this._channel.tap({ selector, ...options }, this._timeout(options));
  }

  async fill(selector: string, value: string, options: channels.FrameFillOptions & TimeoutOptions = {}) {
    return await this._channel.fill({ selector, value, ...options }, this._timeout(options));
  }

  async _highlight(selector: string, style?: string) {
    return await this._channel.highlight({ selector, style }, kNoTimeout);
  }

  async _hideHighlight(selector: string) {
    return await this._channel.hideHighlight({ selector }, kNoTimeout);
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

  pierceFrames(): FrameLocator {
    return new FrameLocator(this, kPierceFramesSelector);
  }

  async focus(selector: string, options: channels.FrameFocusOptions & TimeoutOptions = {}) {
    await this._channel.focus({ selector, ...options }, this._timeout(options));
  }

  async textContent(selector: string, options: channels.FrameTextContentOptions & TimeoutOptions = {}): Promise<null|string> {
    const value = (await this._channel.textContent({ selector, ...options }, this._timeout(options))).value;
    return value === undefined ? null : value;
  }

  async innerText(selector: string, options: channels.FrameInnerTextOptions & TimeoutOptions = {}): Promise<string> {
    return (await this._channel.innerText({ selector, ...options }, this._timeout(options))).value;
  }

  async innerHTML(selector: string, options: channels.FrameInnerHTMLOptions & TimeoutOptions = {}): Promise<string> {
    return (await this._channel.innerHTML({ selector, ...options }, this._timeout(options))).value;
  }

  async getAttribute(selector: string, name: string, options: channels.FrameGetAttributeOptions & TimeoutOptions = {}): Promise<string | null> {
    const value = (await this._channel.getAttribute({ selector, name, ...options }, this._timeout(options))).value;
    return value === undefined ? null : value;
  }

  async inputValue(selector: string, options: channels.FrameInputValueOptions & TimeoutOptions = {}): Promise<string> {
    return (await this._channel.inputValue({ selector, ...options }, this._timeout(options))).value;
  }

  async isChecked(selector: string, options: channels.FrameIsCheckedOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isChecked({ selector, ...options }, this._timeout(options))).value;
  }

  async isDisabled(selector: string, options: channels.FrameIsDisabledOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isDisabled({ selector, ...options }, this._timeout(options))).value;
  }

  async isEditable(selector: string, options: channels.FrameIsEditableOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isEditable({ selector, ...options }, this._timeout(options))).value;
  }

  async isEnabled(selector: string, options: channels.FrameIsEnabledOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isEnabled({ selector, ...options }, this._timeout(options))).value;
  }

  async isHidden(selector: string, options: channels.FrameIsHiddenOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isHidden({ selector, ...options }, kNoTimeout)).value;
  }

  async isVisible(selector: string, options: channels.FrameIsVisibleOptions & TimeoutOptions = {}): Promise<boolean> {
    return (await this._channel.isVisible({ selector, ...options }, kNoTimeout)).value;
  }

  async hover(selector: string, options: channels.FrameHoverOptions & TimeoutOptions = {}) {
    await this._channel.hover({ selector, ...options }, this._timeout(options));
  }

  async selectOption(selector: string, values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions & StrictOptions = {}): Promise<string[]> {
    return (await this._channel.selectOption({ selector, ...convertSelectOptionValues(values), ...options }, this._timeout(options))).values;
  }

  async setInputFiles(selector: string, files: string | FilePayload | string[] | FilePayload[], options: channels.FrameSetInputFilesOptions & TimeoutOptions = {}): Promise<void> {
    const converted = await convertInputFiles(files, this.page().context());
    await this._channel.setInputFiles({ selector, ...converted, ...options }, this._timeout(options));
  }

  async type(selector: string, text: string, options: channels.FrameTypeOptions & TimeoutOptions = {}) {
    await this._channel.type({ selector, text, ...options }, this._timeout(options));
  }

  async press(selector: string, key: string, options: channels.FramePressOptions & TimeoutOptions = {}) {
    await this._channel.press({ selector, key, ...options }, this._timeout(options));
  }

  async check(selector: string, options: channels.FrameCheckOptions & TimeoutOptions = {}) {
    await this._channel.check({ selector, ...options }, this._timeout(options));
  }

  async uncheck(selector: string, options: channels.FrameUncheckOptions & TimeoutOptions = {}) {
    await this._channel.uncheck({ selector, ...options }, this._timeout(options));
  }

  async setChecked(selector: string, checked: boolean, options?: channels.FrameCheckOptions) {
    if (checked)
      await this.check(selector, options);
    else
      await this.uncheck(selector, options);
  }

  async waitForTimeout(timeout: number) {
    await this._channel.waitForTimeout({ waitTimeout: timeout }, kNoTimeout);
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
    }, this._timeout(options));
    return JSHandle.from(result.handle!) as any as structs.SmartHandle<R>;
  }

  async title(): Promise<string> {
    return (await this._channel.title({}, kNoTimeout)).value;
  }

  async _expect(expression: string, options: Omit<channels.FrameExpectParams, 'expression'> & { timeout: number, signal?: AbortSignal }): Promise<ExpectResult> {
    const { timeout, signal, ...rest } = options;
    const params: channels.FrameExpectParams = { expression, ...rest, isNot: !!rest.isNot };
    params.expectedValue = serializeArgument(rest.expectedValue);
    try {
      await this._channel.expect(params, { signal, timeout });
      return { matches: !params.isNot };
    } catch (e) {
      if (e instanceof AbortError)
        return { matches: !!params.isNot, errorMessage: 'Error: ' + assertionAbortedMessage(e.cause) };
      if (!(e instanceof PlaywrightError))
        throw e;
      const details = e.details as channels.FrameExpectErrorDetails;
      const received = details.received ? {
        value: details.received.value !== undefined ? parseResult(details.received.value) : undefined,
        ariaSnapshot: details.received.ariaSnapshot,
      } : undefined;
      return {
        matches: !!params.isNot,
        received,
        log: e.log,
        timedOut: details.timedOut,
        errorMessage: details.customErrorMessage ? 'Error: ' + details.customErrorMessage : undefined,
      };
    }
  }
}

export type ExpectReceived = { value?: any, ariaSnapshot?: string };
export type ExpectResult = { matches: boolean, received?: ExpectReceived, log?: string[], timedOut?: boolean, errorMessage?: string };

export function verifyLoadState(name: string, waitUntil: LifecycleEvent): LifecycleEvent {
  if (waitUntil as unknown === 'networkidle0')
    waitUntil = 'networkidle';
  if (!kLifecycleEvents.has(waitUntil))
    throw new Error(`${name}: expected one of (load|domcontentloaded|networkidle|commit)`);
  return waitUntil;
}
