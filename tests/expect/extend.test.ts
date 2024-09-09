/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { test, expect } from './fixtures';
import { expect as expectUnderTest } from '../../packages/playwright/bundles/expect/src/expectBundleImpl';

expectUnderTest.extend({
  toBeDivisibleBy(actual: number, expected: number) {
    const pass = actual % expected === 0;
    const message: () => string = pass
      ? () =>
        `expected ${this.utils.printReceived(
            actual,
        )} not to be divisible by ${expected}`
      : () =>
        `expected ${this.utils.printReceived(
            actual,
        )} to be divisible by ${expected}`;

    return { message, pass };
  },
  toBeSymbol(actual: symbol, expected: symbol) {
    const pass = actual === expected;
    const message = () =>
      `expected ${actual.toString()} to be Symbol ${expected.toString()}`;

    return { message, pass };
  },
  toBeWithinRange(actual: number, floor: number, ceiling: number) {
    const pass = actual >= floor && actual <= ceiling;
    const message = pass
      ? () =>
        `expected ${this.utils.printReceived(
            actual,
        )} not to be within range ${floor} - ${ceiling}`
      : () =>
        `expected ${this.utils.printReceived(
            actual,
        )} to be within range ${floor} - ${ceiling}`;

    return { message, pass };
  },
});

const expectUnderTestAsAny = expectUnderTest as any;

test('is available globally when matcher is unary', () => {
  expectUnderTestAsAny(15).toBeDivisibleBy(5);
  expectUnderTestAsAny(15).toBeDivisibleBy(3);
  expectUnderTestAsAny(15).not.toBeDivisibleBy(6);

  expect(() =>
    expectUnderTestAsAny(15).toBeDivisibleBy(2),
  ).toThrowErrorMatchingSnapshot(`expected <r>15</> to be divisible by 2`);
});

test('is available globally when matcher is variadic', () => {
  expectUnderTestAsAny(15).toBeWithinRange(10, 20);
  expectUnderTestAsAny(15).not.toBeWithinRange(6, 10);

  expect(() =>
    expectUnderTestAsAny(15).toBeWithinRange(1, 3),
  ).toThrowErrorMatchingSnapshot(`expected <r>15</> to be within range 1 - 3`);
});

test.skip('exposes matcherUtils in context', () => {
  // expectUnderTest.extend({
  //   shouldNotError(_actual: unknown) {
  //     const pass: boolean = this.equals(
  //         this.utils,
  //         Object.assign(matcherUtils, {
  //           iterableEquality,
  //           subsetEquality,
  //         }),
  //     );
  //     const message = pass
  //       ? () => 'expected this.utils to be defined in an extend call'
  //       : () => 'expected this.utils not to be defined in an extend call';

  //     return { message, pass };
  //   },
  // });

  // expectUnderTestAsAny('test').shouldNotError();
});

test('is ok if there is no message specified', () => {
  expectUnderTest.extend({
    toFailWithoutMessage(_expected: unknown) {
      return { message: () => '', pass: false };
    },
  });

  expect(() =>
    expectUnderTestAsAny(true).toFailWithoutMessage(),
  ).toThrowErrorMatchingSnapshot(`<r>No message was specified for this matcher.</>`);
});

test('exposes an equality function to custom matchers', () => {
  expectUnderTest.extend({
    toBeOne(_expected: unknown) {
      return { message: () => '', pass: !!this.equals(1, 1) };
    },
  });

  expect(() => expectUnderTestAsAny('test').toBeOne()).not.toThrow();
});

test('defines asymmetric unary matchers', () => {
  expect(() =>
    expectUnderTest({ value: 2 }).toEqual({ value: expectUnderTestAsAny.toBeDivisibleBy(2) }),
  ).not.toThrow();
  expect(() =>
    expectUnderTest({ value: 3 }).toEqual({ value: expectUnderTestAsAny.toBeDivisibleBy(2) }),
  ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toEqual<d>(</><g>expected</><d>) // deep equality</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<d>  Object {</>
<g>-   "value": toBeDivisibleBy<2>,</>
<r>+   "value": 3,</>
<d>  }</>`);
});

test('defines asymmetric unary matchers that can be prefixed by not', () => {
  expect(() =>
    expectUnderTest({ value: 2 }).toEqual({ value: expectUnderTestAsAny.not.toBeDivisibleBy(2) }),
  ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toEqual<d>(</><g>expected</><d>) // deep equality</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<d>  Object {</>
<g>-   "value": not.toBeDivisibleBy<2>,</>
<r>+   "value": 2,</>
<d>  }</>`);
  expect(() =>
    expectUnderTest({ value: 3 }).toEqual({ value: expectUnderTestAsAny.not.toBeDivisibleBy(2) }),
  ).not.toThrow();
});

test('defines asymmetric variadic matchers', () => {
  expect(() =>
    expectUnderTest({ value: 2 }).toEqual({ value: expectUnderTestAsAny.toBeWithinRange(1, 3) }),
  ).not.toThrow();
  expect(() =>
    expectUnderTest({ value: 3 }).toEqual({ value: expectUnderTestAsAny.toBeWithinRange(4, 11) }),
  ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toEqual<d>(</><g>expected</><d>) // deep equality</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<d>  Object {</>
<g>-   "value": toBeWithinRange<4, 11>,</>
<r>+   "value": 3,</>
<d>  }</>`);
});

test('defines asymmetric variadic matchers that can be prefixed by not', () => {
  expect(() =>
    expectUnderTest({ value: 2 }).toEqual({
      value: expectUnderTestAsAny.not.toBeWithinRange(1, 3),
    }),
  ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toEqual<d>(</><g>expected</><d>) // deep equality</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<d>  Object {</>
<g>-   "value": not.toBeWithinRange<1, 3>,</>
<r>+   "value": 2,</>
<d>  }</>`);
  expect(() =>
    expectUnderTest({ value: 3 }).toEqual({
      value: expectUnderTestAsAny.not.toBeWithinRange(5, 7),
    }),
  ).not.toThrow();
});

test('prints the Symbol into the error message', () => {
  const foo = Symbol('foo');
  const bar = Symbol('bar');

  expect(() =>
    expectUnderTest({ a: foo }).toEqual({
      a: expectUnderTestAsAny.toBeSymbol(bar),
    }),
  ).toThrowErrorMatchingSnapshot(`<d>expect(</><r>received</><d>).</>toEqual<d>(</><g>expected</><d>) // deep equality</>

<g>- Expected  - 1</>
<r>+ Received  + 1</>

<d>  Object {</>
<g>-   "a": toBeSymbol<Symbol(bar)>,</>
<r>+   "a": Symbol(foo),</>
<d>  }</>`);
});

test('allows overriding existing extension', () => {
  expectUnderTest.extend({
    toAllowOverridingExistingMatcher(_expected: unknown) {
      return { message: () => '', pass: _expected === 'bar' };
    },
  });

  expectUnderTestAsAny('foo').not.toAllowOverridingExistingMatcher();

  expectUnderTest.extend({
    toAllowOverridingExistingMatcher(_expected: unknown) {
      return { message: () => '', pass: _expected === 'foo' };
    },
  });

  expectUnderTestAsAny('foo').toAllowOverridingExistingMatcher();
});

test('throws descriptive errors for invalid matchers', () => {
  expect(() =>
    expectUnderTest.extend({
      default: undefined,
    }),
  ).toThrow(
      'expect.extend: `default` is not a valid matcher. Must be a function, is "undefined"',
  );
  expect(() =>
    expectUnderTest.extend({
      // @ts-expect-error: Testing runtime error
      default: 42,
    }),
  ).toThrow(
      'expect.extend: `default` is not a valid matcher. Must be a function, is "number"',
  );
  expect(() =>
    expectUnderTest.extend({
      // @ts-expect-error: Testing runtime error
      default: 'foobar',
    }),
  ).toThrow(
      'expect.extend: `default` is not a valid matcher. Must be a function, is "string"',
  );
});
