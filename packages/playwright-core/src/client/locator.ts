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

import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';
import type { ParsedStackTrace } from '../utils/stackTrace';
import * as util from 'util';
import { isString, monotonicTime } from '../utils';
import { ElementHandle } from './elementHandle';
import type { Frame } from './frame';
import type { FilePayload, FrameExpectOptions, Rect, SelectOption, SelectOptionOptions, TimeoutOptions } from './types';
import { parseResult, serializeArgument } from './jsHandle';
import { escapeForAttributeSelector, escapeForTextSelector } from '../utils/isomorphic/stringUtils';

export type LocatorOptions = {
  hasText?: string | RegExp;
  has?: Locator;
};

export type ByRoleOptions = LocatorOptions & {
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  includeHidden?: boolean;
  level?: number;
  name?: string | RegExp;
  pressed?: boolean;
  selected?: boolean;
};

export class Locator implements api.Locator {
  _frame: Frame;
  _selector: string;

  constructor(frame: Frame, selector: string, options?: LocatorOptions) {
    this._frame = frame;
    this._selector = selector;

    if (options?.hasText)
      this._selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;

    if (options?.has) {
      const locator = options.has;
      if (locator._frame !== frame)
        throw new Error(`Inner "has" locator must belong to the same frame.`);
      this._selector += ` >> internal:has=` + JSON.stringify(locator._selector);
    }
  }

  private async _withElement<R>(task: (handle: ElementHandle<SVGElement | HTMLElement>, timeout?: number) => Promise<R>, timeout?: number): Promise<R> {
    timeout = this._frame.page()._timeoutSettings.timeout({ timeout });
    const deadline = timeout ? monotonicTime() + timeout : 0;

    return this._frame._wrapApiCall<R>(async () => {
      const result = await this._frame._channel.waitForSelector({ selector: this._selector, strict: true, state: 'attached', timeout });
      const handle = ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
      if (!handle)
        throw new Error(`Could not resolve ${this._selector} to DOM Element`);
      try {
        return await task(handle, deadline ? deadline - monotonicTime() : 0);
      } finally {
        await handle.dispose();
      }
    });
  }

  page() {
    return this._frame.page();
  }

  async boundingBox(options?: TimeoutOptions): Promise<Rect | null> {
    return this._withElement(h => h.boundingBox(), options?.timeout);
  }

  async check(options: channels.ElementHandleCheckOptions = {}) {
    return this._frame.check(this._selector, { strict: true, ...options });
  }

  async click(options: channels.ElementHandleClickOptions = {}): Promise<void> {
    return this._frame.click(this._selector, { strict: true, ...options });
  }

  async dblclick(options: channels.ElementHandleDblclickOptions = {}): Promise<void> {
    return this._frame.dblclick(this._selector, { strict: true, ...options });
  }

  async dispatchEvent(type: string, eventInit: Object = {}, options?: TimeoutOptions) {
    return this._frame.dispatchEvent(this._selector, type, eventInit, { strict: true, ...options });
  }

  async dragTo(target: Locator, options: channels.FrameDragAndDropOptions = {}) {
    return this._frame.dragAndDrop(this._selector, target._selector, {
      strict: true,
      ...options,
    });
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunctionOn<SVGElement | HTMLElement, Arg, R>, arg?: Arg, options?: TimeoutOptions): Promise<R> {
    return this._withElement(h => h.evaluate(pageFunction, arg), options?.timeout);
  }

  async evaluateAll<R, Arg>(pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    return this._frame.$$eval(this._selector, pageFunction, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunctionOn<any, Arg, R>, arg?: Arg, options?: TimeoutOptions): Promise<structs.SmartHandle<R>> {
    return this._withElement(h => h.evaluateHandle(pageFunction, arg), options?.timeout);
  }

  async fill(value: string, options: channels.ElementHandleFillOptions = {}): Promise<void> {
    return this._frame.fill(this._selector, value, { strict: true, ...options });
  }

  async clear(options: channels.ElementHandleFillOptions = {}): Promise<void> {
    return this.fill('', options);
  }

  async _highlight() {
    // VS Code extension uses this one, keep it for now.
    return this._frame._highlight(this._selector);
  }

  async highlight() {
    return this._frame._highlight(this._selector);
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this._frame, this._selector + ' >> ' + selector, options);
  }

  getByTestId(testId: string): Locator {
    return this.locator(getByTestIdSelector(testId));
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
    return this._frame.$$(this._selector);
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

  async focus(options?: TimeoutOptions): Promise<void> {
    return this._frame.focus(this._selector, { strict: true, ...options });
  }

  async blur(options?: TimeoutOptions): Promise<void> {
    await this._frame._channel.blur({ selector: this._selector, strict: true, ...options });
  }

  async count(): Promise<number> {
    return this._frame._queryCount(this._selector);
  }

  async getAttribute(name: string, options?: TimeoutOptions): Promise<string | null> {
    return this._frame.getAttribute(this._selector, name, { strict: true, ...options });
  }

  async hover(options: channels.ElementHandleHoverOptions = {}): Promise<void> {
    return this._frame.hover(this._selector, { strict: true, ...options });
  }

  async innerHTML(options?: TimeoutOptions): Promise<string> {
    return this._frame.innerHTML(this._selector, { strict: true, ...options });
  }

  async innerText(options?: TimeoutOptions): Promise<string> {
    return this._frame.innerText(this._selector, { strict: true, ...options });
  }

  async inputValue(options?: TimeoutOptions): Promise<string> {
    return this._frame.inputValue(this._selector, { strict: true, ...options });
  }

  async isChecked(options?: TimeoutOptions): Promise<boolean> {
    return this._frame.isChecked(this._selector, { strict: true, ...options });
  }

  async isDisabled(options?: TimeoutOptions): Promise<boolean> {
    return this._frame.isDisabled(this._selector, { strict: true, ...options });
  }

  async isEditable(options?: TimeoutOptions): Promise<boolean> {
    return this._frame.isEditable(this._selector, { strict: true, ...options });
  }

  async isEnabled(options?: TimeoutOptions): Promise<boolean> {
    return this._frame.isEnabled(this._selector, { strict: true, ...options });
  }

  async isHidden(options?: TimeoutOptions): Promise<boolean> {
    return this._frame.isHidden(this._selector, { strict: true, ...options });
  }

  async isVisible(options?: TimeoutOptions): Promise<boolean> {
    return this._frame.isVisible(this._selector, { strict: true, ...options });
  }

  async press(key: string, options: channels.ElementHandlePressOptions = {}): Promise<void> {
    return this._frame.press(this._selector, key, { strict: true, ...options });
  }

  async screenshot(options: Omit<channels.ElementHandleScreenshotOptions, 'mask'> & { path?: string, mask?: Locator[] } = {}): Promise<Buffer> {
    return this._withElement((h, timeout) => h.screenshot({ ...options, timeout }), options.timeout);
  }

  async scrollIntoViewIfNeeded(options: channels.ElementHandleScrollIntoViewIfNeededOptions = {}) {
    return this._withElement((h, timeout) => h.scrollIntoViewIfNeeded({ ...options, timeout }), options.timeout);
  }

  async selectOption(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions = {}): Promise<string[]> {
    return this._frame.selectOption(this._selector, values, { strict: true, ...options });
  }

  async selectText(options: channels.ElementHandleSelectTextOptions = {}): Promise<void> {
    return this._withElement((h, timeout) => h.selectText({ ...options, timeout }), options.timeout);
  }

  async setChecked(checked: boolean, options?: channels.ElementHandleCheckOptions) {
    if (checked)
      await this.check(options);
    else
      await this.uncheck(options);
  }

  async setInputFiles(files: string | FilePayload | string[] | FilePayload[], options: channels.ElementHandleSetInputFilesOptions = {}) {
    return this._frame.setInputFiles(this._selector, files, { strict: true, ...options });
  }

  async tap(options: channels.ElementHandleTapOptions = {}): Promise<void> {
    return this._frame.tap(this._selector, { strict: true, ...options });
  }

  async textContent(options?: TimeoutOptions): Promise<string | null> {
    return this._frame.textContent(this._selector, { strict: true, ...options });
  }

  async type(text: string, options: channels.ElementHandleTypeOptions = {}): Promise<void> {
    return this._frame.type(this._selector, text, { strict: true, ...options });
  }

  async uncheck(options: channels.ElementHandleUncheckOptions = {}) {
    return this._frame.uncheck(this._selector, { strict: true, ...options });
  }

  async allInnerTexts(): Promise<string[]> {
    return this._frame.$$eval(this._selector, ee => ee.map(e => (e as HTMLElement).innerText));
  }

  async allTextContents(): Promise<string[]> {
    return this._frame.$$eval(this._selector, ee => ee.map(e => e.textContent || ''));
  }

  waitFor(options: channels.FrameWaitForSelectorOptions & { state: 'attached' | 'visible' }): Promise<void>;
  waitFor(options?: channels.FrameWaitForSelectorOptions): Promise<void>;
  async waitFor(options?: channels.FrameWaitForSelectorOptions): Promise<void> {
    await this._frame._channel.waitForSelector({ selector: this._selector, strict: true, omitReturnValue: true, ...options });
  }

  async _expect(customStackTrace: ParsedStackTrace, expression: string, options: Omit<FrameExpectOptions, 'expectedValue'> & { expectedValue?: any }): Promise<{ matches: boolean, received?: any, log?: string[] }> {
    return this._frame._wrapApiCall(async () => {
      const params: channels.FrameExpectParams = { selector: this._selector, expression, ...options, isNot: !!options.isNot };
      params.expectedValue = serializeArgument(options.expectedValue);
      const result = (await this._frame._channel.expect(params));
      if (result.received !== undefined)
        result.received = parseResult(result.received);
      return result;
    }, false /* isInternal */, customStackTrace);
  }

  [util.inspect.custom]() {
    return this.toString();
  }

  toString() {
    return `Locator@${this._selector}`;
  }
}

export class FrameLocator implements api.FrameLocator {
  private _frame: Frame;
  private _frameSelector: string;

  constructor(frame: Frame, selector: string) {
    this._frame = frame;
    this._frameSelector = selector;
  }

  locator(selector: string, options?: { hasText?: string | RegExp }): Locator {
    return new Locator(this._frame, this._frameSelector + ' >> internal:control=enter-frame >> ' + selector, options);
  }

  getByTestId(testId: string): Locator {
    return this.locator(getByTestIdSelector(testId));
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

let testIdAttributeName: string = 'data-testid';

export function setTestIdAttribute(attributeName: string) {
  testIdAttributeName = attributeName;
}

function getByAttributeTextSelector(attrName: string, text: string | RegExp, options?: { exact?: boolean }): string {
  if (!isString(text))
    return `internal:attr=[${attrName}=${text}]`;
  return `internal:attr=[${attrName}=${escapeForAttributeSelector(text, options?.exact || false)}]`;
}

export function getByTestIdSelector(testId: string): string {
  return getByAttributeTextSelector(testIdAttributeName, testId, { exact: true });
}


export function getByLabelSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return 'internal:label=' + escapeForTextSelector(text, !!options?.exact);
}

export function getByAltTextSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return getByAttributeTextSelector('alt', text, options);
}

export function getByTitleSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return getByAttributeTextSelector('title', text, options);
}

export function getByPlaceholderSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return getByAttributeTextSelector('placeholder', text, options);
}

export function getByTextSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return 'internal:text=' + escapeForTextSelector(text, !!options?.exact);
}

export function getByRoleSelector(role: string, options: ByRoleOptions = {}): string {
  const props: string[][] = [];
  if (options.checked !== undefined)
    props.push(['checked', String(options.checked)]);
  if (options.disabled !== undefined)
    props.push(['disabled', String(options.disabled)]);
  if (options.selected !== undefined)
    props.push(['selected', String(options.selected)]);
  if (options.expanded !== undefined)
    props.push(['expanded', String(options.expanded)]);
  if (options.includeHidden !== undefined)
    props.push(['include-hidden', String(options.includeHidden)]);
  if (options.level !== undefined)
    props.push(['level', String(options.level)]);
  if (options.name !== undefined)
    props.push(['name', isString(options.name) ? escapeForAttributeSelector(options.name, false) : String(options.name)]);
  if (options.pressed !== undefined)
    props.push(['pressed', String(options.pressed)]);
  return `internal:role=${role}${props.map(([n, v]) => `[${n}=${v}]`).join('')}`;
}
