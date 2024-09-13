/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

test.describe('.assertions()', () => {
  test('does not throw', () => {
    expectUnderTest.assertions(2);
    expectUnderTest('a').not.toBe('b');
    expectUnderTest('a').toBe('a');
  });

  test('redeclares different assertion count', () => {
    expectUnderTest.assertions(3);
    expectUnderTest('a').not.toBe('b');
    expectUnderTest('a').toBe('a');
    expectUnderTest.assertions(2);
  });
  test('expects no assertions', () => {
    expectUnderTest.assertions(0);
  });
});

test.describe('.hasAssertions()', () => {
  test('does not throw if there is an assertion', () => {
    expectUnderTest.hasAssertions();
    expectUnderTest('a').toBe('a');
  });

  test('throws if expected is not undefined', () => {
    expect(() =>
      (expectUnderTest as any).hasAssertions(2)
    ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>)[.not].hasAssertions()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>2</>`);
  });
});

test.describe('numPassingAsserts', () => {
  test.skip('verify the default value of numPassingAsserts', () => {
    const { numPassingAsserts } = expectUnderTest.getState();
    expect(numPassingAsserts).toBe(0);
  });

  test('verify the resetting of numPassingAsserts after a test', () => {
    expect('a').toBe('a');
    expect('a').toBe('a');
    // reset state
    expectUnderTest.extractExpectedAssertionsErrors();
    const { numPassingAsserts } = expectUnderTest.getState();
    expect(numPassingAsserts).toBe(0);
  });

  test.skip('verify the correctness of numPassingAsserts count for passing test', () => {
    expect('a').toBe('a');
    expect('a').toBe('a');
    const { numPassingAsserts } = expectUnderTest.getState();
    expect(numPassingAsserts).toBe(2);
  });

  test.skip('verify the correctness of numPassingAsserts count for failing test', () => {
    expect('a').toBe('a');
    try {
      expect('a').toBe('b');
    } catch (error) { }
    const { numPassingAsserts } = expectUnderTest.getState();
    expect(numPassingAsserts).toBe(1);
  });
});
