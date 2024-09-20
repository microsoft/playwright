/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

const expectUnderTestAsAny = expectUnderTest as any;

expectUnderTest.extend({
  toCustomMatch(callback: () => unknown, expected: unknown) {
    const actual = callback();

    if (actual !== expected) {
      return {
        message: () => `Expected "${expected}" but got "${actual}"`,
        pass: false,
      };
    }

    return {
      message: () => '',
      pass: true,
    };
  },
  toMatchPredicate(received: unknown, expected: (a: unknown) => void) {
    expected(received);
    return {
      message: () => '',
      pass: true,
    };
  },
});

test('stack trace points to correct location when using matchers', () => {
  try {
    expectUnderTest(true).toBe(false);
  } catch (error: any) {
    expect(error.stack).toContain('stacktrace.test.ts:');
  }
});

test('stack trace points to correct location when using nested matchers', () => {
  try {
    expectUnderTestAsAny(true).toMatchPredicate((value: unknown) => {
      expectUnderTest(value).toBe(false);
    });
  } catch (error: any) {
    expect(error.stack).toContain('stacktrace.test.ts:');
  }
});

test('stack trace points to correct location when throwing from a custom matcher', () => {
  try {
    expectUnderTestAsAny(() => {
      const foo = () => bar();
      const bar = () => baz();
      const baz = () => {
        throw new Error('Expected');
      };

      foo();
    }).toCustomMatch('bar');
  } catch (error: any) {
    expect(error.stack).toContain('stacktrace.test.ts:');
  }
});
