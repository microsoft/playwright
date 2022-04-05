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

import type * as expect from 'expect';
import type { Page, Locator, APIResponse, PageScreenshotOptions, LocatorScreenshotOptions } from 'playwright-core';

export declare type AsymmetricMatcher = Record<string, any>;

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
type ExtraMatchers<T, Type, Matchers> = T extends Type ? Matchers : IfAny<T, Matchers, {}>;

type MakeMatchers<R, T> = PlaywrightTest.Matchers<R, T> &
  ExtraMatchers<T, Page, PageMatchers> &
  ExtraMatchers<T, Locator, LocatorMatchers> &
  ExtraMatchers<T, APIResponse, APIResponseMatchers>;

export declare type Expect = {
  <T = unknown>(actual: T, messageOrOptions?: string | { message?: string }): MakeMatchers<void, T>;
  soft: <T = unknown>(actual: T, messageOrOptions?: string | { message?: string }) => MakeMatchers<void, T>;
  poll: <T = unknown>(actual: () => T | Promise<T>, messageOrOptions?: string | { message?: string, timeout?: number }) => Omit<PlaywrightTest.Matchers<Promise<void>, T>, 'rejects' | 'resolves'>;

  extend(arg0: any): void;
  getState(): expect.MatcherState;
  setState(state: Partial<expect.MatcherState>): void;
  any(expectedObject: any): AsymmetricMatcher;
  anything(): AsymmetricMatcher;
  arrayContaining(sample: Array<unknown>): AsymmetricMatcher;
  objectContaining(sample: Record<string, unknown>): AsymmetricMatcher;
  stringContaining(expected: string): AsymmetricMatcher;
  stringMatching(expected: string | RegExp): AsymmetricMatcher;
  /**
   * Removed following methods because they rely on a test-runner integration from Jest which we don't support:
   * - assertions()
   * - extractExpectedAssertionsErrors()
   * – hasAssertions()
   */
};

type ImageComparatorOptions = {
  threshold?: number,
  maxDiffPixels?: number,
  maxDiffPixelRatio?: number,
};

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

/**
 * Removed methods require the jest.fn() integration from Jest to spy on function calls which we don't support:
 * - lastCalledWith()
 * - lastReturnedWith()
 * - nthCalledWith()
 * - nthReturnedWith()
 * - toBeCalled()
 * - toBeCalledTimes()
 * - toBeCalledWith()
 * - toHaveBeenCalled()
 * - toHaveBeenCalledTimes()
 * - toHaveBeenCalledWith()
 * - toHaveBeenLastCalledWith()
 * - toHaveBeenNthCalledWith()
 * - toHaveLastReturnedWith()
 * - toHaveNthReturnedWith()
 * - toHaveReturned()
 * - toHaveReturnedTimes()
 * - toHaveReturnedWith()
 * - toReturn()
 * - toReturnTimes()
 * - toReturnWith()
 * - toThrowErrorMatchingSnapshot()
 * - toThrowErrorMatchingInlineSnapshot()
 */
type SupportedExpectProperties =
  'toBe' |
  'toBeCloseTo' |
  'toBeDefined' |
  'toBeFalsy' |
  'toBeGreaterThan' |
  'toBeGreaterThanOrEqual' |
  'toBeInstanceOf' |
  'toBeLessThan' |
  'toBeLessThanOrEqual' |
  'toBeNaN' |
  'toBeNull' |
  'toBeTruthy' |
  'toBeUndefined' |
  'toContain' |
  'toContainEqual' |
  'toEqual' |
  'toHaveLength' |
  'toHaveProperty' |
  'toMatch' |
  'toMatchObject' |
  'toStrictEqual' |
  'toThrow' |
  'toThrowError'

declare global {
  export namespace PlaywrightTest {
    export interface Matchers<R, T = unknown> extends Pick<expect.Matchers<R>, SupportedExpectProperties> {
      /**
       * If you know how to test something, `.not` lets you test its opposite.
       */
      not: MakeMatchers<R, T>;
      /**
       * Use resolves to unwrap the value of a fulfilled promise so any other
       * matcher can be chained. If the promise is rejected the assertion fails.
       */
      resolves: MakeMatchers<Promise<R>, Awaited<T>>;
      /**
      * Unwraps the reason of a rejected promise so any other matcher can be chained.
      * If the promise is fulfilled the assertion fails.
      */
      rejects: MakeMatchers<Promise<R>, Awaited<T>>;
      /**
       * Match snapshot
       */
      toMatchSnapshot(options?: ImageComparatorOptions & {
        name?: string | string[],
      }): R;
      /**
       * Match snapshot
       */
      toMatchSnapshot(name: string | string[], options?: ImageComparatorOptions): R;
    }
  }
}

interface LocatorMatchers {
  /**
   * Asserts input is checked (or unchecked if { checked: false } is passed).
   */
  toBeChecked(options?: { checked?: boolean, timeout?: number }): Promise<void>;

  /**
  * Asserts input is disabled.
  */
  toBeDisabled(options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts input is editable.
  */
  toBeEditable(options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts given DOM node or input has no text content or no input value.
  */
  toBeEmpty(options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts input is enabled.
  */
  toBeEnabled(options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts given DOM is a focused (active) in document.
  */
  toBeFocused(options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts given DOM node is hidden or detached from DOM.
  */
  toBeHidden(options?: { timeout?: number }): Promise<void>;

  /**
   * Asserts element's text content matches given pattern or contains given substring.
   */
  toContainText(expected: string | RegExp | (string | RegExp)[], options?: { timeout?: number, useInnerText?: boolean }): Promise<void>;

  /**
   * Asserts element's attributes `name` matches expected value.
   */
  toHaveAttribute(name: string, expected: string | RegExp, options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts that DOM node has a given CSS class.
  */
  toHaveClass(className: string | RegExp | (string | RegExp)[], options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts number of DOM nodes matching given locator.
  */
  toHaveCount(expected: number, options?: { timeout?: number }): Promise<void>;

  /**
   * Asserts element's computed CSS property `name` matches expected value.
   */
  toHaveCSS(name: string, expected: string | RegExp, options?: { timeout?: number }): Promise<void>;

  /**
   * Asserts element's `id` attribute matches expected value.
   */
  toHaveId(expected: string | RegExp, options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts JavaScript object that corresponds to the Node has a property with given value.
  */
  toHaveJSProperty(name: string, value: any, options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts element's text content.
  */
  toHaveText(expected: string | RegExp | (string | RegExp)[], options?: { timeout?: number, useInnerText?: boolean }): Promise<void>;

  /**
   * Asserts input element's value.
   */
  toHaveValue(expected: string | RegExp, options?: { timeout?: number }): Promise<void>;

  /**
   * Asserts given DOM node visible on the screen.
   */
  toBeVisible(options?: { timeout?: number }): Promise<void>;
}
interface PageMatchers {
  /**
   * Asserts page's title.
   */
  toHaveTitle(expected: string | RegExp, options?: { timeout?: number }): Promise<void>;

  /**
  * Asserts page's URL.
  */
  toHaveURL(expected: string | RegExp, options?: { timeout?: number }): Promise<void>;
}

interface APIResponseMatchers {
  /**
   * Asserts given APIResponse's status is between 200 and 299.
   */
  toBeOK(): Promise<void>;
}

export { };
