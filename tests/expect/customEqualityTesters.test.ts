/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest, mock } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

class Volume {
  public amount: number;
  public unit: 'L' | 'mL';

  constructor(amount: number, unit: 'L' | 'mL') {
    this.amount = amount;
    this.unit = unit;
  }

  toString(): string {
    return `[Volume ${this.amount}${this.unit}]`;
  }

  equals(other: Volume): boolean {
    if (this.unit === other.unit)
      return this.amount === other.amount;
    else if (this.unit === 'L' && other.unit === 'mL')
      return this.amount * 1000 === other.amount;
    else
      return this.amount === other.amount * 1000;

  }
}

function createVolume(amount: number, unit: 'L' | 'mL' = 'L') {
  return new Volume(amount, unit);
}

function isVolume(a: unknown): a is Volume {
  return a instanceof Volume;
}

const areVolumesEqual = (
  a: unknown,
  b: unknown,
): boolean | undefined => {
  const isAVolume = isVolume(a);
  const isBVolume = isVolume(b);

  if (isAVolume && isBVolume)
    return a.equals(b);
  else if (isAVolume !== isBVolume)
    return false;
  else
    return undefined;

};

function* toIterator<T>(array: Array<T>): Iterator<T> {
  for (const obj of array)
    yield obj;

}

expectUnderTest.extend({
  toEqualVolume(expected: Volume, actual: Volume) {
    const result = this.equals(expected, actual, this.customTesters);

    return {
      message: () =>
        `Expected Volume object: ${expected.toString()}. Actual Volume object: ${actual.toString()}`,
      pass: result,
    };
  },
});

// Create Volumes with different specifications but the same value for use in
// tests. Without the custom tester, these volumes would not be equal because
// their properties have different values. However, with our custom tester they
// are equal.
const volume1 = createVolume(1, 'L');
const volume2 = createVolume(1000, 'mL');

const volumeArg1 = createVolume(1, 'L');
const volumeArg2 = createVolume(1000, 'mL');
const volumeArg3 = createVolume(2, 'L');
const volumeArg4 = createVolume(2000, 'mL');

const volumeReturn1 = createVolume(2, 'L');
const volumeReturn2 = createVolume(2000, 'mL');

const testArgs = [volumeArg1, volumeArg2, [volumeArg3, volumeArg4]];
// Swap the order of args to assert custom tester sees these volumes as equal
const expectedArgs = [volumeArg2, volumeArg1, [volumeArg4, volumeArg3]];

expectUnderTest.addEqualityTesters([areVolumesEqual]);

test.describe('with custom equality testers', () => {
  test('basic matchers customTesters do not apply to still do not pass different Volume objects', () => {
    expectUnderTest(volume1).not.toBe(volume2);
    expectUnderTest([volume1]).not.toContain(volume2);
  });

  test('basic matchers pass different Volume objects', () => {
    expectUnderTest(volume1).toEqual(volume1);
    expectUnderTest(volume1).toEqual(volume2);
    expectUnderTest([volume1, volume2]).toEqual([volume2, volume1]);
    expectUnderTest(new Map([['key', volume1]])).toEqual(new Map([['key', volume2]]));
    expectUnderTest(new Set([volume1])).toEqual(new Set([volume2]));
    expectUnderTest(toIterator([volume1, volume2])).toEqual(
        toIterator([volume2, volume1]),
    );
    expectUnderTest([volume1]).toContainEqual(volume2);
    expectUnderTest({ a: volume1 }).toHaveProperty('a', volume2);
    expectUnderTest({ a: volume1, b: undefined }).toStrictEqual({
      a: volume2,
      b: undefined,
    });
    expectUnderTest({ a: 1, b: { c: volume1 } }).toMatchObject({
      a: 1,
      b: { c: volume2 },
    });
  });

  test('asymmetric matchers pass different Volume objects', () => {
    expectUnderTest([volume1]).toEqual(expectUnderTest.arrayContaining([volume2]));
    expectUnderTest({ a: 1, b: { c: volume1 } }).toEqual(
        expectUnderTest.objectContaining({ b: { c: volume2 } }),
    );
  });

  test('spy matchers pass different Volume objects', () => {
    const mockFn = mock.fn<(...args: Array<unknown>) => unknown>(
        () => volumeReturn1,
    );
    mockFn(...testArgs);

    expectUnderTest(mockFn).toHaveBeenCalledWith(...expectedArgs);
    expectUnderTest(mockFn).toHaveBeenLastCalledWith(...expectedArgs);
    expectUnderTest(mockFn).toHaveBeenNthCalledWith(1, ...expectedArgs);

    expectUnderTest(mockFn).toHaveReturnedWith(volumeReturn2);
    expectUnderTest(mockFn).toHaveLastReturnedWith(volumeReturn2);
    expectUnderTest(mockFn).toHaveNthReturnedWith(1, volumeReturn2);
  });

  test('custom matchers pass different Volume objects', () => {
    (expectUnderTest as any)(volume1).toEqualVolume(volume2);
  });

  test('toBe recommends toStrictEqual even with different Volume objects', () => {
    expectUnderTest(() => expectUnderTest(volume1).toBe(volume2)).toThrow('toStrictEqual');
  });

  test('toBe recommends toEqual even with different Volume objects', () => {
    expectUnderTest(() => expectUnderTest({ a: undefined, b: volume1 }).toBe({ b: volume2 })).toThrow(
        'toEqual',
    );
  });

  test('toContains recommends toContainEquals even with different Volume objects', () => {
    expectUnderTest(() => expectUnderTest([volume1]).toContain(volume2)).toThrow(
        'toContainEqual',
    );
  });

  test('toMatchObject error shows Volume objects as equal', () => {
    expect(() =>
      expectUnderTest({ a: 1, b: volume1 }).toMatchObject({ a: 2, b: volume2 })
    ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toMatchObject<d>(</><g>expected</><d>)</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<d>  Object {</>
<g>-   "a": 2,</>
<r>+   "a": 1,</>
<d>    "b": Volume {</>
<d>      "amount": 1000,</>
<d>      "unit": "mL",</>
<d>    },</>
<d>  }</>`);
  });

  test('iterableEquality still properly detects cycles', () => {
    const a = new Set();
    a.add(volume1);
    a.add(a);

    const b = new Set();
    b.add(volume2);
    b.add(b);

    expectUnderTest(a).toEqual(b);
  });
});
