/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as expect from 'expect';

export declare type AsymmetricMatcher = Record<string, any>;

export declare type Expect = {
  <T = unknown>(actual: T): PlaywrightTest.Matchers<T>;

  // Sourced from node_modules/expect/build/types.d.ts
  assertions(arg0: number): void;
  extend(arg0: any): void;
  extractExpectedAssertionsErrors: typeof expect['extractExpectedAssertionsErrors'];
  getState(): expect.MatcherState;
  hasAssertions(): void;
  setState(state: Partial<expect.MatcherState>): void;
  any(expectedObject: any): AsymmetricMatcher;
  anything(): AsymmetricMatcher;
  arrayContaining(sample: Array<unknown>): AsymmetricMatcher;
  objectContaining(sample: Record<string, unknown>): AsymmetricMatcher;
  stringContaining(expected: string): AsymmetricMatcher;
  stringMatching(expected: string | RegExp): AsymmetricMatcher;
};

type OverriddenExpectProperties =
'not' |
'resolves' |
'rejects' |
'toMatchInlineSnapshot' |
'toThrowErrorMatchingInlineSnapshot' |
'toMatchSnapshot' |
'toThrowErrorMatchingSnapshot';

declare global {
  export namespace PlaywrightTest {
    export interface Matchers<R> extends Omit<expect.Matchers<R>, OverriddenExpectProperties> {
      /**
       * If you know how to test something, `.not` lets you test its opposite.
       */
      not: PlaywrightTest.Matchers<R>;
      /**
       * Use resolves to unwrap the value of a fulfilled promise so any other
       * matcher can be chained. If the promise is rejected the assertion fails.
       */
      resolves: PlaywrightTest.Matchers<Promise<R>>;
      /**
      * Unwraps the reason of a rejected promise so any other matcher can be chained.
      * If the promise is fulfilled the assertion fails.
      */
      rejects: PlaywrightTest.Matchers<Promise<R>>;
      /**
       * Match snapshot
       */
      toMatchSnapshot(options: {
        name: string,
        threshold?: number
      }): R;
      /**
       * Match snapshot
       */
      toMatchSnapshot(name: string, options?: {
        threshold?: number
      }): R;

      /**
       * Asserts input is checked.
       */
      toBeChecked(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts input is disabled.
       */
      toBeDisabled(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts input is editable.
       */
      toBeEditable(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts given DOM node or input has no text content or no input value.
       */
      toBeEmpty(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts input is enabled.
       */
      toBeEnabled(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts given DOM is a focused (active) in document.
       */
      toBeFocused(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts given DOM node is hidden or detached from DOM.
       */
      toBeHidden(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts given DOM node visible on the screen.
       */
      toBeVisible(options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts element's text content matches given pattern or contains given substring.
       */
      toContainText(expected: string | RegExp | (string|RegExp)[], options?: { timeout?: number, useInnerText?: boolean }): Promise<R>;

      /**
       * Asserts element's attributes `name` matches expected value.
       */
      toHaveAttribute(name: string, expected: string | RegExp, options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts that DOM node has a given CSS class.
       */
      toHaveClass(className: string | RegExp | (string|RegExp)[], options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts number of DOM nodes matching given locator.
       */
      toHaveCount(expected: number, options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts element's computed CSS property `name` matches expected value.
       */
      toHaveCSS(name: string, expected: string | RegExp, options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts element's `id` attribute matches expected value.
       */
      toHaveId(expected: string | RegExp, options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts JavaScript object that corresponds to the Node has a property with given value.
       */
      toHaveJSProperty(name: string, value: any, options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts element's text content.
       */
      toHaveText(expected: string | RegExp | (string|RegExp)[], options?: { timeout?: number, useInnerText?: boolean }): Promise<R>;

      /**
       * Asserts page's title.
       */
      toHaveTitle(expected: string | RegExp, options?: { timeout?: number }): Promise<R>;

      /**
       * Asserts page's URL.
       */
      toHaveURL(expected: string | RegExp, options?: { timeout?: number }): Promise<R>;

       /**
       * Asserts input element's value.
       */
      toHaveValue(expected: string | RegExp, options?: { timeout?: number }): Promise<R>;
    }
  }
}

export { };
