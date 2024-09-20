/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { Tester } from '@jest/expect-utils';
import { getType } from 'jest-get-type';
import { AsymmetricMatcher } from './asymmetricMatchers';
import type {
  Expect,
  MatcherState,
  MatchersObject,
  SyncExpectationResult,
} from './types';

// Global matchers object holds the list of available matchers and
// the state, that can hold matcher specific values that change over time.
const JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object');

// Notes a built-in/internal Jest matcher.
// Jest may override the stack trace of Errors thrown by internal matchers.
export const INTERNAL_MATCHER_FLAG = Symbol.for('$$jest-internal-matcher');

if (!Object.prototype.hasOwnProperty.call(globalThis, JEST_MATCHERS_OBJECT)) {
  const defaultState: MatcherState = {
    assertionCalls: 0,
    expectedAssertionsNumber: null,
    isExpectingAssertions: false,
    numPassingAsserts: 0,
    suppressedErrors: [], // errors that are not thrown immediately.
  };
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    value: {
      customEqualityTesters: [],
      matchers: Object.create(null),
      state: defaultState,
    },
  });
}

export const getState = <State extends MatcherState = MatcherState>(): State =>
  (globalThis as any)[JEST_MATCHERS_OBJECT].state;

export const setState = <State extends MatcherState = MatcherState>(
  state: Partial<State>,
): void => {
  Object.assign((globalThis as any)[JEST_MATCHERS_OBJECT].state, state);
};

export const getMatchers = (): MatchersObject =>
  (globalThis as any)[JEST_MATCHERS_OBJECT].matchers;

export const setMatchers = (
  matchers: MatchersObject,
  isInternal: boolean,
  expect: Expect,
): void => {
  Object.keys(matchers).forEach(key => {
    const matcher = matchers[key];

    if (typeof matcher !== 'function') {
      throw new TypeError(
          `expect.extend: \`${key}\` is not a valid matcher. Must be a function, is "${getType(
              matcher,
          )}"`,
      );
    }

    Object.defineProperty(matcher, INTERNAL_MATCHER_FLAG, {
      value: isInternal,
    });

    if (!isInternal) {
      // expect is defined

      class CustomMatcher extends AsymmetricMatcher<
        [unknown, ...Array<unknown>]
      > {
        constructor(inverse = false, ...sample: [unknown, ...Array<unknown>]) {
          super(sample, inverse);
        }

        asymmetricMatch(other: unknown) {
          const { pass } = matcher.call(
              this.getMatcherContext(),
              other,
              ...this.sample,
          ) as SyncExpectationResult;

          return this.inverse ? !pass : pass;
        }

        toString() {
          return `${this.inverse ? 'not.' : ''}${key}`;
        }

        override getExpectedType() {
          return 'any';
        }

        override toAsymmetricMatcher() {
          return `${this.toString()}<${this.sample.map(String).join(', ')}>`;
        }
      }

      Object.defineProperty(expect, key, {
        configurable: true,
        enumerable: true,
        value: (...sample: [unknown, ...Array<unknown>]) =>
          new CustomMatcher(false, ...sample),
        writable: true,
      });
      Object.defineProperty(expect.not, key, {
        configurable: true,
        enumerable: true,
        value: (...sample: [unknown, ...Array<unknown>]) =>
          new CustomMatcher(true, ...sample),
        writable: true,
      });
    }
  });

  Object.assign((globalThis as any)[JEST_MATCHERS_OBJECT].matchers, matchers);
};

export const getCustomEqualityTesters = (): Array<Tester> =>
  (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters;

export const addCustomEqualityTesters = (newTesters: Array<Tester>): void => {
  if (!Array.isArray(newTesters)) {
    throw new TypeError(
        `expect.customEqualityTesters: Must be set to an array of Testers. Was given "${getType(
            newTesters,
        )}"`,
    );
  }

  (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters.push(
      ...newTesters,
  );
};
