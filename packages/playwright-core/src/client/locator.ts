/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ElementHandle } from './elementHandle';
import { asLocator } from '../utils/isomorphic/locatorGenerators';
import { getByAltTextSelector, getByLabelSelector, getByPlaceholderSelector, getByRoleSelector, getByTestIdSelector, getByTextSelector, getByTitleSelector } from '../utils/isomorphic/locatorUtils';
import { escapeForTextSelector } from '../utils/isomorphic/stringUtils';
import { isString } from '../utils/isomorphic/rtti';
import { monotonicTime } from '../utils/isomorphic/time';

import type { Frame } from './frame';
import type { FilePayload, FrameExpectParams, Rect, SelectOption, SelectOptionOptions, TimeoutOptions } from './types';
import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type { ByRoleOptions } from '../utils/isomorphic/locatorUtils';
import type * as channels from '@protocol/channels';


export type LocatorOptions = {
  hasText?: string | RegExp;
  hasNotText?: string | RegExp;
  has?: Locator;
  hasNot?: Locator;
  visible?: boolean;
};

export class Locator implements api.Locator {
  _frame: Frame;
  _selector: string;

  constructor(frame: Frame, selector: string, options?: LocatorOptions) {
    this._frame = frame;
    this._selector = selector;

    if (options?.hasText)
      this._selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;

    if (options?.hasNotText)
      this._selector += ` >> internal:has-not-text=${escapeForTextSelector(options.hasNotText, false)}`;

    if (options?.has) {
      const locator = options.has;
      if (locator._frame !== frame)
        throw new Error(`Inner "has" locator must belong to the same frame.`);
      this._selector += ` >> internal:has=` + JSON.stringify(locator._selector);
    }

    if (options?.hasNot) {
      const locator = options.hasNot;
      if (locator._frame !== frame)
        throw new Error(`Inner "hasNot" locator must belong to the same frame.`);
      this._selector += ` >> internal:has-not=` + JSON.stringify(locator._selector);
    }

    if (options?.visible !== undefined)
      this._selector += ` >> visible=${options.visible ? 'true' : 'false'}`;

    if (this._frame._platform.inspectCustom)
      (this as any)[this._frame._platform.inspectCustom] = () => this._inspect();
  }

  private async _withElement<R>(task: (handle: ElementHandle<SVGElement | HTMLElement>, timeout?: number) => Promise<R>, options: { title: string, internal?: boolean, timeout?: number }): Promise<R> {
    const timeout = this._frame._timeout({ timeout: options.timeout });
    const deadline = timeout ? monotonicTime() + timeout : 0;

    return await this._frame._wrapApiCall<R>(async () => {
      const result = await this._frame._channel.waitForSelector({ selector: this._selector, strict: true, state: 'attached', timeout });
      const handle = ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
      if (!handle)
        throw new Error(`Could not resolve ${this._selector} to DOM Element`);
      try {
        return await task(handle, deadline ? deadline - monotonicTime() : 0);
      } finally {
        await handle.dispose();
      }
    }, { title: options.title, internal: options.internal });
  }

  _equals(locator: Locator) {
    return this._frame === locator._frame && this._selector === locator._selector;
  }

  page() {
    return this._frame.page();
  }

  async boundingBox(options?: TimeoutOptions): Promise<Rect | null> {
    return await this._withElement(h => h.boundingBox(), { title: 'Bounding box', timeout: options?.timeout });
  }

  async check(options: channels.ElementHandleCheckOptions & TimeoutOptions = {}) {
    return await this._frame.check(this._selector, { strict: true, ...options });
  }

  async click(options: channels.ElementHandleClickOptions & TimeoutOptions = {}): Promise<void> {
    return await this._frame.click(this._selector, { strict: true, ...options });
  }

  async dblclick(options: channels.ElementHandleDblclickOptions & TimeoutOptions = {}): Promise<void> {
    await this._frame.dblclick(this._selector, { strict: true, ...options });
  }

  async dispatchEvent(type: string, eventInit: Object = {}, options?: TimeoutOptions) {
    return await this._frame.dispatchEvent(this._selector, type, eventInit, { strict: true, ...options });
  }

  async dragTo(target: Locator, options: channels.FrameDragAndDropOptions & TimeoutOptions = {}) {
    return await this._frame.dragAndDrop(this._selector, target._selector, {
      strict: true,
      ...options,
    });
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunctionOn<SVGElement | HTMLElement, Arg, R>, arg?: Arg, options?: TimeoutOptions): Promise<R> {
    return await this._withElement(h => h.evaluate(pageFunction, arg), { title: 'Evaluate', timeout: options?.timeout });
  }

  async _evaluateFunction(functionDeclaration: string, options?: TimeoutOptions) {
    return await this._withElement(h => h._evaluateFunction(functionDeclaration), { title: 'Evaluate', timeout: options?.timeout });
  }

  async evaluateAll<R, Arg>(pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    return await this._frame.$$eval(this._selector, pageFunction, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunctionOn<any, Arg, R>, arg?: Arg, options?: TimeoutOptions): Promise<structs.SmartHandle<R>> {
    return await this._withElement(h => h.evaluateHandle(pageFunction, arg), { title: 'Evaluate', timeout: options?.timeout });
  }

  async fill(value: string, options: channels.ElementHandleFillOptions & TimeoutOptions = {}): Promise<void> {
    return await this._frame.fill(this._selector, value, { strict: true, ...options });
  }

  async clear(options: channels.ElementHandleFillOptions = {}): Promise<void> {
    await this._frame._wrapApiCall(() => this.fill('', options), { title: 'Clear' });
  }

  async _highlight() {
    // VS Code extension uses this one, keep it for now.
    return await this._frame._highlight(this._selector);
  }

  async highlight() {
    return await this._frame._highlight(this._selector);
  }

  locator(selectorOrLocator: string | Locator, options?: Omit<LocatorOptions, 'visible'>): Locator {
    if (isString(selectorOrLocator))
      return new Locator(this._frame, this._selector + ' >> ' + selectorOrLocator, options);
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._selector + ' >> internal:chain=' + JSON.stringify(selectorOrLocator._selector), options);
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
    return new FrameLocator(this._frame, this._selector + ' >> ' + selector);
  }

  filter(options?: LocatorOptions): Locator {
    return new Locator(this._frame, this._selector, options);
  }

  async elementHandle(options?: TimeoutOptions): Promise<ElementHandle<SVGElement | HTMLElement>> {
    return await this._frame.waitForSelector(this._selector, { strict: true, state: 'attached', ...options })!;
  }

  async elementHandles(): Promise<api.ElementHandle<SVGElement | HTMLElement>[]> {
    return await this._frame.$$(this._selector);
  }

  contentFrame() {
    return new FrameLocator(this._frame, this._selector);
  }

  describe(description: string) {
    return new Locator(this._frame, this._selector + ' >> internal:describe=' + JSON.stringify(description));
  }

  first(): Locator {
    return new Locator(this._frame, this._selector + ' >> nth=0');
  }

  last(): Locator {
    return new Locator(this._frame, this._selector + ` >> nth=-1`);
  }

  nth(index: number): Locator {
    return new Locator(this._frame, this._selector + ` >> nth=${index}`);
  }

  and(locator: Locator): Locator {
    if (locator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._selector + ` >> internal:and=` + JSON.stringify(locator._selector));
  }

  or(locator: Locator): Locator {
    if (locator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._selector + ` >> internal:or=` + JSON.stringify(locator._selector));
  }

  async focus(options?: TimeoutOptions): Promise<void> {
    return await this._frame.focus(this._selector, { strict: true, ...options });
  }

  async blur(options?: TimeoutOptions): Promise<void> {
    await this._frame._channel.blur({ selector: this._selector, strict: true, ...options, timeout: this._frame._timeout(options) });
  }

  async count(): Promise<number> {
    return await this._frame._queryCount(this._selector);
  }

  async _resolveSelector(): Promise<{ resolvedSelector: string }> {
    return await this._frame._channel.resolveSelector({ selector: this._selector });
  }

  async getAttribute(name: string, options?: TimeoutOptions): Promise<string | null> {
    return await this._frame.getAttribute(this._selector, name, { strict: true, ...options });
  }

  async hover(options: channels.ElementHandleHoverOptions & TimeoutOptions = {}): Promise<void> {
    return await this._frame.hover(this._selector, { strict: true, ...options });
  }

  async innerHTML(options?: TimeoutOptions): Promise<string> {
    return await this._frame.innerHTML(this._selector, { strict: true, ...options });
  }

  async innerText(options?: TimeoutOptions): Promise<string> {
    return await this._frame.innerText(this._selector, { strict: true, ...options });
  }

  async inputValue(options?: TimeoutOptions): Promise<string> {
    return await this._frame.inputValue(this._selector, { strict: true, ...options });
  }

  async isChecked(options?: TimeoutOptions): Promise<boolean> {
    return await this._frame.isChecked(this._selector, { strict: true, ...options });
  }

  async isDisabled(options?: TimeoutOptions): Promise<boolean> {
    return await this._frame.isDisabled(this._selector, { strict: true, ...options });
  }

  async isEditable(options?: TimeoutOptions): Promise<boolean> {
    return await this._frame.isEditable(this._selector, { strict: true, ...options });
  }

  async isEnabled(options?: TimeoutOptions): Promise<boolean> {
    return await this._frame.isEnabled(this._selector, { strict: true, ...options });
  }

  async isHidden(options?: TimeoutOptions): Promise<boolean> {
    return await this._frame.isHidden(this._selector, { strict: true, ...options });
  }

  async isVisible(options?: TimeoutOptions): Promise<boolean> {
    return await this._frame.isVisible(this._selector, { strict: true, ...options });
  }

  async press(key: string, options: channels.ElementHandlePressOptions & TimeoutOptions = {}): Promise<void> {
    return await this._frame.press(this._selector, key, { strict: true, ...options });
  }

  async screenshot(options: Omit<channels.ElementHandleScreenshotOptions, 'mask'> & TimeoutOptions & { path?: string, mask?: api.Locator[] } = {}): Promise<Buffer> {
    const mask = options.mask as Locator[] | undefined;
    return await this._withElement((h, timeout) => h.screenshot({ ...options, mask, timeout }), { title: 'Screenshot', timeout: options.timeout });
  }

  async ariaSnapshot(options?: TimeoutOptions): Promise<string> {
    const result = await this._frame._channel.ariaSnapshot({ ...options, selector: this._selector, timeout: this._frame._timeout(options) });
    return result.snapshot;
  }

  async scrollIntoViewIfNeeded(options: channels.ElementHandleScrollIntoViewIfNeededOptions & TimeoutOptions = {}) {
    return await this._withElement((h, timeout) => h.scrollIntoViewIfNeeded({ ...options, timeout }), { title: 'Scroll into view', timeout: options.timeout });
  }

  async selectOption(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions = {}): Promise<string[]> {
    return await this._frame.selectOption(this._selector, values, { strict: true, ...options });
  }

  async selectText(options: channels.ElementHandleSelectTextOptions & TimeoutOptions = {}): Promise<void> {
    return await this._withElement((h, timeout) => h.selectText({ ...options, timeout }), { title: 'Select text', timeout: options.timeout });
  }

  async setChecked(checked: boolean, options?: channels.ElementHandleCheckOptions & TimeoutOptions) {
    if (checked)
      await this.check(options);
    else
      await this.uncheck(options);
  }

  async setInputFiles(files: string | FilePayload | string[] | FilePayload[], options: channels.ElementHandleSetInputFilesOptions & TimeoutOptions = {}) {
    return await this._frame.setInputFiles(this._selector, files, { strict: true, ...options });
  }

  async tap(options: channels.ElementHandleTapOptions & TimeoutOptions = {}): Promise<void> {
    return await this._frame.tap(this._selector, { strict: true, ...options });
  }

  async textContent(options?: TimeoutOptions): Promise<string | null> {
    return await this._frame.textContent(this._selector, { strict: true, ...options });
  }

  async type(text: string, options: channels.ElementHandleTypeOptions & TimeoutOptions = {}): Promise<void> {
    return await this._frame.type(this._selector, text, { strict: true, ...options });
  }

  async pressSequentially(text: string, options: channels.ElementHandleTypeOptions & TimeoutOptions = {}): Promise<void> {
    return await this.type(text, options);
  }

  async uncheck(options: channels.ElementHandleUncheckOptions & TimeoutOptions = {}) {
    return await this._frame.uncheck(this._selector, { strict: true, ...options });
  }

  async all(): Promise<Locator[]> {
    return new Array(await this.count()).fill(0).map((e, i) => this.nth(i));
  }

  async allInnerTexts(): Promise<string[]> {
    return await this._frame.$$eval(this._selector, ee => ee.map(e => (e as HTMLElement).innerText));
  }

  async allTextContents(): Promise<string[]> {
    return await this._frame.$$eval(this._selector, ee => ee.map(e => e.textContent || ''));
  }

  waitFor(options: channels.FrameWaitForSelectorOptions & TimeoutOptions & { state: 'attached' | 'visible' }): Promise<void>;
  waitFor(options?: channels.FrameWaitForSelectorOptions & TimeoutOptions): Promise<void>;
  async waitFor(options?: channels.FrameWaitForSelectorOptions & TimeoutOptions): Promise<void> {
    await this._frame._channel.waitForSelector({ selector: this._selector, strict: true, omitReturnValue: true, ...options, timeout: this._frame._timeout(options) });
  }

  async _expect(expression: string, options: FrameExpectParams): Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }> {
    return this._frame._expect(expression, {
      ...options,
      selector: this._selector,
    });
  }

  private _inspect() {
    return this.toString();
  }

  toString() {
    return asLocator('javascript', this._selector);
  }
}

export class FrameLocator implements api.FrameLocator {
  private _frame: Frame;
  private _frameSelector: string;

  constructor(frame: Frame, selector: string) {
    this._frame = frame;
    this._frameSelector = selector;
  }

  locator(selectorOrLocator: string | Locator, options?: LocatorOptions): Locator {
    if (isString(selectorOrLocator))
      return new Locator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator, options);
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator._selector, options);
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

  owner() {
    return new Locator(this._frame, this._frameSelector);
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selector);
  }

  first(): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ' >> nth=0');
  }

  last(): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=-1`);
  }

  nth(index: number): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=${index}`);
  }
}

let _testIdAttributeName: string = 'data-testid';

export function testIdAttributeName(): string {
  return _testIdAttributeName;
}

export function setTestIdAttribute(attributeName: string) {
  _testIdAttributeName = attributeName;
}
