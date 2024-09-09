/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test } from './fixtures';
import { expect as expectUnderTest } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

test.describe('Symbol in objects', () => {
  test('should compare objects with Symbol keys', () => {
    const sym = Symbol('foo');
    const obj1 = { [sym]: 'one' };
    const obj2 = { [sym]: 'two' };
    const obj3 = { [sym]: 'one' };

    expectUnderTest(obj1).toEqual(obj3);
    expectUnderTest(obj1).not.toEqual(obj2);
  });

  test('should compare objects with mixed keys and Symbol', () => {
    const sym = Symbol('foo2');
    const obj1 = { foo: 2, [sym]: 'one' };
    const obj2 = { foo: 2, [sym]: 'two' };
    const obj3 = { foo: 2, [sym]: 'one' };

    expectUnderTest(obj1).toEqual(obj3);
    expectUnderTest(obj1).not.toEqual(obj2);
  });

  test('should compare objects with different Symbol keys', () => {
    const sym = Symbol('foo');
    const sym2 = Symbol('foo');
    const obj1 = { [sym]: 'one' };
    const obj2 = { [sym2]: 'one' };
    const obj3 = { [sym]: 'one' };

    expectUnderTest(obj1).toEqual(obj3);
    expectUnderTest(obj1).not.toEqual(obj2);
  });
});
