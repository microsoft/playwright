/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as expect from 'expect';
import type { ExpectedAssertionsErrors } from 'expect/build/types';

export declare type AsymmetricMatcher = Record<string, any>;

export declare type Expect = {
  <T = unknown>(actual: T): PlaywrightTest.Matchers<T>;

  // Sourced from node_modules/expect/build/types.d.ts
  assertions(arg0: number): void;
  extend(arg0: any): void;
  extractExpectedAssertionsErrors: () => ExpectedAssertionsErrors;
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

declare global {
  export namespace PlaywrightTest {
    export interface Matchers<R> extends expect.Matchers<R> {
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
      toMatchSnapshot(options?: {
        name?: string,
        threshold?: number
      }): R;
      /**
       * Match snapshot
       */
      toMatchSnapshot(name: string, options?: {
        threshold?: number
      }): R;
    }
  }
}

export { };
