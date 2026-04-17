/**
 * Copyright (c) Meta Platforms, Inc. and affiliates. All Rights Reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/jestjs/jest/blob/v30.2.0/LICENSE
 */

// Based on https://github.com/jestjs/jest/tree/v30.2.0/packages/expect

import {
  arrayBufferEquality,
  equals,
  getObjectKeys,
  getObjectSubset,
  getPath,
  isA,
  isError,
  iterableEquality,
  pathAsArray,
  sparseArrayEquality,
  subsetEquality,
  typeEquality,
} from '@jest/expect-utils';
import * as matcherUtils from 'jest-matcher-utils';
import {
  DIM_COLOR,
  EXPECTED_COLOR,
  INVERTED_COLOR,
  RECEIVED_COLOR,
  SUGGEST_TO_CONTAIN_EQUAL,
  ensureExpectedIsNonNegativeInteger,
  ensureNoExpected,
  ensureNumbers,
  getLabelPrinter,
  matcherErrorMessage,
  matcherHint,
  printDiffOrStringify,
  printExpected,
  printReceived,
  printWithType,
  stringify,
} from 'jest-matcher-utils';
import { formatExecError, formatStackTrace, separateMessageFromStack } from 'jest-message-util';

import type { EqualsFunction, Tester } from '@jest/expect-utils';
import type { MatcherHintOptions } from 'jest-matcher-utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SyncExpectationResult = {
  pass: boolean;
  message(): string;
};

type AsyncExpectationResult = Promise<SyncExpectationResult>;

export type ExpectationResult = SyncExpectationResult | AsyncExpectationResult;

export type RawMatcherFn<Context extends MatcherContext = MatcherContext> = {
  (this: Context, actual: any, ...expected: Array<any>): ExpectationResult;
};

export type MatchersObject = {
  [name: string]: RawMatcherFn;
};

interface MatcherUtils {
  customTesters: Array<Tester>;
  equals: EqualsFunction;
  utils: typeof matcherUtils & {
    iterableEquality: Tester;
    subsetEquality: Tester;
  };
}

interface MatcherState {
  error?: Error;
  isNot?: boolean;
  promise?: string;
}

export type MatcherContext = MatcherUtils & Readonly<MatcherState>;

type AsymmetricMatcherInterface = {
  asymmetricMatch(other: unknown): boolean;
  toString(): string;
  getExpectedType?(): string;
  toAsymmetricMatcher?(): string;
};

function getType(value: unknown): string {
  if (value === undefined)
    return 'undefined';
  if (value === null)
    return 'null';
  if (Array.isArray(value))
    return 'array';
  if (typeof value === 'boolean')
    return 'boolean';
  if (typeof value === 'function')
    return 'function';
  if (typeof value === 'number')
    return 'number';
  if (typeof value === 'string')
    return 'string';
  if (typeof value === 'bigint')
    return 'bigint';
  if (typeof value === 'object') {
    if ((value as object).constructor === RegExp)
      return 'regexp';
    if ((value as object).constructor === Map)
      return 'map';
    if ((value as object).constructor === Set)
      return 'set';
    if ((value as object).constructor === Date)
      return 'date';
    return 'object';
  }
  if (typeof value === 'symbol')
    return 'symbol';
  throw new Error(`value of unknown type: ${value as any}`);
}

const isPrimitive = (value: unknown): boolean => Object(value) !== value;

export function isPromise<T>(candidate: unknown): candidate is Promise<T> {
  return candidate !== null && candidate !== undefined
      && (typeof candidate === 'object' || typeof candidate === 'function')
      && typeof (candidate as any).then === 'function';
}

// -----------------------------------------------------------------------------
// Asymmetric matchers (asymmetricMatchers.ts)
// -----------------------------------------------------------------------------

const functionToString = Function.prototype.toString;

function fnNameFor(func: () => unknown) {
  if (func.name)
    return func.name;

  const matches = functionToString
      .call(func)
      .match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/);
  return matches ? matches[1] : '<anonymous>';
}

export const utils = Object.freeze({
  ...matcherUtils,
  iterableEquality,
  subsetEquality,
});

function hasProperty(obj: object | null, property: string | symbol): boolean {
  if (!obj)
    return false;
  if (Object.prototype.hasOwnProperty.call(obj, property))
    return true;
  return hasProperty(Object.getPrototypeOf(obj), property);
}

export abstract class AsymmetricMatcher<T> implements AsymmetricMatcherInterface {
  $$typeof = Symbol.for('jest.asymmetricMatcher');

  constructor(
    protected sample: T,
    protected inverse = false,
  ) {}

  protected getMatcherContext(): MatcherContext {
    return {
      customTesters: [],
      equals,
      isNot: this.inverse,
      utils,
    };
  }

  abstract asymmetricMatch(other: unknown): boolean;
  abstract toString(): string;
  getExpectedType?(): string;
  toAsymmetricMatcher?(): string;
}

export function buildCustomAsymmetricMatcher(matcherName: string, matcher: RawMatcherFn) {
  class CustomMatcher extends AsymmetricMatcher<[unknown, ...Array<unknown>]> {
    constructor(inverse: boolean = false, ...sample: [unknown, ...Array<unknown>]) {
      super(sample, inverse);
    }

    asymmetricMatch(other: unknown) {
      const { pass } = matcher.call(
          (this as any).getMatcherContext(),
          other,
          ...this.sample,
      ) as SyncExpectationResult;
      return this.inverse ? !pass : pass;
    }

    toString() {
      return `${this.inverse ? 'not.' : ''}${matcherName}`;
    }

    override getExpectedType() {
      return 'any';
    }

    override toAsymmetricMatcher() {
      return `${this.toString()}<${this.sample.map(String).join(', ')}>`;
    }
  }
  const positive = (...sample: [unknown, ...Array<unknown>]) => new CustomMatcher(false, ...sample);
  const inverse = (...sample: [unknown, ...Array<unknown>]) => new CustomMatcher(true, ...sample);
  return { positive, inverse };
}

class Any extends AsymmetricMatcher<any> {
  constructor(sample: unknown) {
    if (sample === undefined) {
      throw new TypeError(
          'any() expects to be passed a constructor function. ' +
          'Please pass one or use anything() to match any object.',
      );
    }
    super(sample);
  }

  asymmetricMatch(other: unknown) {
    if (this.sample === String)
      return typeof other === 'string' || other instanceof String;
    if (this.sample === Number)
      return typeof other === 'number' || other instanceof Number;
    if (this.sample === Function)
      return typeof other === 'function' || other instanceof Function;
    if (this.sample === Boolean)
      return typeof other === 'boolean' || other instanceof Boolean;
    if (this.sample === BigInt)
      return typeof other === 'bigint' || other instanceof BigInt;
    if (this.sample === Symbol)
      return typeof other === 'symbol' || other instanceof Symbol;
    if (this.sample === Object)
      return typeof other === 'object';
    if (this.sample === Array)
      return Array.isArray(other);
    return other instanceof this.sample;
  }

  toString() {
    return 'Any';
  }

  override getExpectedType() {
    if (this.sample === String)
      return 'string';
    if (this.sample === Number)
      return 'number';
    if (this.sample === Function)
      return 'function';
    if (this.sample === Object)
      return 'object';
    if (this.sample === Boolean)
      return 'boolean';
    if (this.sample === Array)
      return 'array';
    return fnNameFor(this.sample);
  }

  override toAsymmetricMatcher() {
    return `Any<${fnNameFor(this.sample)}>`;
  }
}

class Anything extends AsymmetricMatcher<void> {
  asymmetricMatch(other: unknown) {
    return other !== null && other !== undefined;
  }

  toString() {
    return 'Anything';
  }

  override toAsymmetricMatcher() {
    return 'Anything';
  }
}

class ArrayContaining extends AsymmetricMatcher<Array<unknown>> {
  constructor(sample: Array<unknown>, inverse = false) {
    super(sample, inverse);
  }

  asymmetricMatch(other: unknown) {
    if (!Array.isArray(this.sample)) {
      throw new TypeError(
          `You must provide an array to ${this.toString()}, not '${typeof this
              .sample}'.`,
      );
    }

    const matcherContext = this.getMatcherContext();
    const result =
      this.sample.length === 0 ||
      (Array.isArray(other) &&
        this.sample.every(item =>
          other.some(another =>
            equals(item, another, matcherContext.customTesters),
          ),
        ));

    return this.inverse ? !result : result;
  }

  toString() {
    return `Array${this.inverse ? 'Not' : ''}Containing`;
  }

  override getExpectedType() {
    return 'array';
  }
}

class ArrayOf extends AsymmetricMatcher<unknown> {
  asymmetricMatch(other: unknown) {
    const matcherContext = this.getMatcherContext();
    const result =
      Array.isArray(other) &&
      other.every(item =>
        equals(this.sample, item, matcherContext.customTesters),
      );

    return this.inverse ? !result : result;
  }

  toString() {
    return `${this.inverse ? 'Not' : ''}ArrayOf`;
  }

  override getExpectedType() {
    return 'array';
  }
}

class ObjectContaining extends AsymmetricMatcher<Record<string | symbol, unknown>> {
  constructor(sample: Record<string | symbol, unknown>, inverse = false) {
    super(sample, inverse);
  }

  asymmetricMatch(other: any) {
    if (typeof this.sample !== 'object') {
      throw new TypeError(
          `You must provide an object to ${this.toString()}, not '${typeof this
              .sample}'.`,
      );
    }

    if (typeof other !== 'object' || Array.isArray(other))
      return false;

    let result = true;

    const matcherContext = this.getMatcherContext();
    const objectKeys = getObjectKeys(this.sample);

    for (const key of objectKeys) {
      if (
        !hasProperty(other, key) ||
        !equals(this.sample[key], other[key], matcherContext.customTesters)
      ) {
        result = false;
        break;
      }
    }

    return this.inverse ? !result : result;
  }

  toString() {
    return `Object${this.inverse ? 'Not' : ''}Containing`;
  }

  override getExpectedType() {
    return 'object';
  }
}

class StringContaining extends AsymmetricMatcher<string> {
  constructor(sample: string, inverse = false) {
    if (!isA('String', sample))
      throw new Error('Expected is not a string');
    super(sample, inverse);
  }

  asymmetricMatch(other: unknown) {
    const result = isA<string>('String', other) && other.includes(this.sample);
    return this.inverse ? !result : result;
  }

  toString() {
    return `String${this.inverse ? 'Not' : ''}Containing`;
  }

  override getExpectedType() {
    return 'string';
  }
}

class StringMatching extends AsymmetricMatcher<RegExp> {
  constructor(sample: string | RegExp, inverse = false) {
    if (!isA('String', sample) && !isA('RegExp', sample))
      throw new Error('Expected is not a String or a RegExp');
    super(new RegExp(sample), inverse);
  }

  asymmetricMatch(other: unknown) {
    const result = isA<string>('String', other) && this.sample.test(other);
    return this.inverse ? !result : result;
  }

  toString() {
    return `String${this.inverse ? 'Not' : ''}Matching`;
  }

  override getExpectedType() {
    return 'string';
  }
}

class CloseTo extends AsymmetricMatcher<number> {
  private readonly precision: number;

  constructor(sample: number, precision = 2, inverse = false) {
    if (!isA('Number', sample))
      throw new Error('Expected is not a Number');
    if (!isA('Number', precision))
      throw new Error('Precision is not a Number');

    super(sample);
    this.inverse = inverse;
    this.precision = precision;
  }

  asymmetricMatch(other: unknown) {
    if (!isA<number>('Number', other))
      return false;
    let result = false;
    if (other === Number.POSITIVE_INFINITY && this.sample === Number.POSITIVE_INFINITY)
      result = true;
    else if (other === Number.NEGATIVE_INFINITY && this.sample === Number.NEGATIVE_INFINITY)
      result = true;
    else
      result = Math.abs(this.sample - other) < Math.pow(10, -this.precision) / 2;
    return this.inverse ? !result : result;
  }

  toString() {
    return `Number${this.inverse ? 'Not' : ''}CloseTo`;
  }

  override getExpectedType() {
    return 'number';
  }

  override toAsymmetricMatcher(): string {
    return [
      this.toString(),
      this.sample,
      `(${this.precision} ${this.precision === 1 ? 'digit' : 'digits'})`,
    ].join(' ');
  }
}

export const any = (expectedObject: unknown): Any => new Any(expectedObject);
export const anything = (): Anything => new Anything();
export const arrayContaining = (sample: Array<unknown>): ArrayContaining => new ArrayContaining(sample);
export const arrayNotContaining = (sample: Array<unknown>): ArrayContaining => new ArrayContaining(sample, true);
export const arrayOf = (sample: unknown): ArrayOf => new ArrayOf(sample);
export const notArrayOf = (sample: unknown): ArrayOf => new ArrayOf(sample, true);
export const objectContaining = (sample: Record<string, unknown>): ObjectContaining => new ObjectContaining(sample);
export const objectNotContaining = (sample: Record<string, unknown>): ObjectContaining => new ObjectContaining(sample, true);
export const stringContaining = (expected: string): StringContaining => new StringContaining(expected);
export const stringNotContaining = (expected: string): StringContaining => new StringContaining(expected, true);
export const stringMatching = (expected: string | RegExp): StringMatching => new StringMatching(expected);
export const stringNotMatching = (expected: string | RegExp): StringMatching => new StringMatching(expected, true);
export const closeTo = (expected: number, precision?: number): CloseTo => new CloseTo(expected, precision);
export const notCloseTo = (expected: number, precision?: number): CloseTo => new CloseTo(expected, precision, true);

// -----------------------------------------------------------------------------
// Print helpers (print.ts)
// -----------------------------------------------------------------------------

const printSubstring = (val: string): string => val.replace(/"|\\/g, '\\$&');

const printReceivedStringContainExpectedSubstring = (
  received: string,
  start: number,
  length: number,
): string =>
  RECEIVED_COLOR(
      `"${printSubstring(received.slice(0, start))}${INVERTED_COLOR(
          printSubstring(received.slice(start, start + length)),
      )}${printSubstring(received.slice(start + length))}"`,
  );

const printReceivedStringContainExpectedResult = (
  received: string,
  result: RegExpExecArray | null,
): string =>
  result === null
    ? printReceived(received)
    : printReceivedStringContainExpectedSubstring(received, result.index, result[0].length);

const printReceivedArrayContainExpectedItem = (
  received: Array<unknown>,
  index: number,
): string =>
  RECEIVED_COLOR(
      `[${received
          .map((item, i) => {
            const stringified = stringify(item);
            return i === index ? INVERTED_COLOR(stringified) : stringified;
          })
          .join(', ')}]`,
  );

const printCloseTo = (
  receivedDiff: number,
  expectedDiff: number,
  precision: number,
  isNot: boolean | undefined,
): string => {
  const receivedDiffString = stringify(receivedDiff);
  const expectedDiffString = receivedDiffString.includes('e')
    ? expectedDiff.toExponential(0)
    : 0 <= precision && precision < 20
      ? expectedDiff.toFixed(precision + 1)
      : stringify(expectedDiff);

  return (
    `Expected precision:  ${isNot ? '    ' : ''}  ${stringify(precision)}\n` +
    `Expected difference: ${isNot ? 'not ' : ''}< ${EXPECTED_COLOR(expectedDiffString)}\n` +
    `Received difference: ${isNot ? '    ' : ''}  ${RECEIVED_COLOR(receivedDiffString)}`
  );
};

const printConstructorName = (
  label: string,
  constructor: Function,
  isNot: boolean,
  isExpected: boolean,
): string =>
  typeof constructor.name === 'string'
    ? constructor.name.length === 0
      ? `${label} name is an empty string`
      : `${label}: ${isNot ? (isExpected ? 'not ' : '    ') : ''}${
        isExpected
          ? EXPECTED_COLOR(constructor.name)
          : RECEIVED_COLOR(constructor.name)
      }`
    : `${label} name is not a string`;

const printExpectedConstructorName = (label: string, expected: Function): string =>
  `${printConstructorName(label, expected, false, true)}\n`;

const printExpectedConstructorNameNot = (label: string, expected: Function): string =>
  `${printConstructorName(label, expected, true, true)}\n`;

const printReceivedConstructorName = (label: string, received: Function): string =>
  `${printConstructorName(label, received, false, false)}\n`;

const printReceivedConstructorNameNot = (
  label: string,
  received: Function,
  expected: Function,
): string =>
  typeof expected.name === 'string' &&
  expected.name.length > 0 &&
  typeof received.name === 'string' &&
  received.name.length > 0
    ? `${printConstructorName(label, received, true, false)} ${
      Object.getPrototypeOf(received) === expected
        ? 'extends'
        : 'extends … extends'
    } ${EXPECTED_COLOR(expected.name)}\n`
    : `${printConstructorName(label, received, false, false)}\n`;

// -----------------------------------------------------------------------------
// Default matchers (matchers.ts)
// -----------------------------------------------------------------------------

const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';
const EXPECTED_VALUE_LABEL = 'Expected value';
const RECEIVED_VALUE_LABEL = 'Received value';

const toStrictEqualTesters = [
  iterableEquality,
  typeEquality,
  sparseArrayEquality,
  arrayBufferEquality,
];

type ContainIterable =
  | Array<unknown>
  | Set<unknown>
  | NodeListOf<Node>
  | DOMTokenList
  | HTMLCollectionOf<any>;

export const matchers: MatchersObject = {
  toBe(received: unknown, expected: unknown) {
    const matcherName = 'toBe';
    const options: MatcherHintOptions = {
      comment: 'Object.is equality',
      isNot: this.isNot,
      promise: this.promise,
    };

    const pass = Object.is(received, expected);

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: not ${printExpected(expected)}`
      : () => {
        const expectedType = getType(expected);

        let deepEqualityName = null;
        if (expectedType !== 'map' && expectedType !== 'set') {
          if (equals(received, expected, [...this.customTesters, ...toStrictEqualTesters], true))
            deepEqualityName = 'toStrictEqual';
          else if (equals(received, expected, [...this.customTesters, iterableEquality]))
            deepEqualityName = 'toEqual';
        }

        return (
          matcherHint(matcherName, undefined, undefined, options) +
            '\n\n' +
            (deepEqualityName === null
              ? ''
              : `${DIM_COLOR(
                  `If it should pass with deep equality, replace "${matcherName}" with "${deepEqualityName}"`,
              )}\n\n`) +
            printDiffOrStringify(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, false)
        );
      };

    return { actual: received, expected, message, name: matcherName, pass };
  },

  toBeCloseTo(received: number, expected: number, precision = 2) {
    const matcherName = 'toBeCloseTo';
    const secondArgument = arguments.length === 3 ? 'precision' : undefined;
    const isNot = this.isNot;
    const options: MatcherHintOptions = {
      isNot,
      promise: this.promise,
      secondArgument,
      secondArgumentColor: (arg: string) => arg,
    };

    if (typeof expected !== 'number') {
      throw new TypeError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${EXPECTED_COLOR('expected')} value must be a number`,
              printWithType('Expected', expected, printExpected),
          ),
      );
    }

    if (typeof received !== 'number') {
      throw new TypeError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must be a number`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    let pass = false;
    let expectedDiff = 0;
    let receivedDiff = 0;

    if (received === Number.POSITIVE_INFINITY && expected === Number.POSITIVE_INFINITY) {
      pass = true;
    } else if (received === Number.NEGATIVE_INFINITY && expected === Number.NEGATIVE_INFINITY) {
      pass = true;
    } else {
      expectedDiff = Math.pow(10, -precision) / 2;
      receivedDiff = Math.abs(expected - received);
      pass = receivedDiff < expectedDiff;
    }

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: not ${printExpected(expected)}\n` +
          (receivedDiff === 0
            ? ''
            : `Received:     ${printReceived(received)}\n` +
              `\n${printCloseTo(receivedDiff, expectedDiff, precision, isNot)}`)
      : () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: ${printExpected(expected)}\n` +
          `Received: ${printReceived(received)}\n` +
          '\n' +
          printCloseTo(receivedDiff, expectedDiff, precision, isNot);

    return { message, pass };
  },

  toBeDefined(received: unknown, expected: void) {
    const matcherName = 'toBeDefined';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };
    ensureNoExpected(expected, matcherName, options);

    const pass = received !== void 0;
    const message = () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

    return { message, pass };
  },

  toBeFalsy(received: unknown, expected: void) {
    const matcherName = 'toBeFalsy';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };
    ensureNoExpected(expected, matcherName, options);

    const pass = !received;
    const message = () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

    return { message, pass };
  },

  toBeGreaterThan(received: number | bigint, expected: number | bigint) {
    const matcherName = 'toBeGreaterThan';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { isNot, promise: this.promise };
    ensureNumbers(received, expected, matcherName, options);

    const pass = received > expected;
    const message = () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      `Expected:${isNot ? ' not' : ''} > ${printExpected(expected)}\n` +
      `Received:${isNot ? '    ' : ''}   ${printReceived(received)}`;

    return { message, pass };
  },

  toBeGreaterThanOrEqual(received: number | bigint, expected: number | bigint) {
    const matcherName = 'toBeGreaterThanOrEqual';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { isNot, promise: this.promise };
    ensureNumbers(received, expected, matcherName, options);

    const pass = received >= expected;
    const message = () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      `Expected:${isNot ? ' not' : ''} >= ${printExpected(expected)}\n` +
      `Received:${isNot ? '    ' : ''}    ${printReceived(received)}`;

    return { message, pass };
  },

  toBeInstanceOf(received: any, expected: Function) {
    const matcherName = 'toBeInstanceOf';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };

    if (typeof expected !== 'function') {
      throw new TypeError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${EXPECTED_COLOR('expected')} value must be a function`,
              printWithType('Expected', expected, printExpected),
          ),
      );
    }

    const pass = received instanceof expected;

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          printExpectedConstructorNameNot('Expected constructor', expected) +
          (typeof received.constructor === 'function' && received.constructor !== expected
            ? printReceivedConstructorNameNot('Received constructor', received.constructor, expected)
            : '')
      : () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          printExpectedConstructorName('Expected constructor', expected) +
          (isPrimitive(received) || Object.getPrototypeOf(received) === null
            ? `\nReceived value has no prototype\nReceived value: ${printReceived(received)}`
            : typeof received.constructor === 'function'
              ? printReceivedConstructorName('Received constructor', received.constructor)
              : `\nReceived value: ${printReceived(received)}`);

    return { message, pass };
  },

  toBeLessThan(received: number | bigint, expected: number | bigint) {
    const matcherName = 'toBeLessThan';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { isNot, promise: this.promise };
    ensureNumbers(received, expected, matcherName, options);

    const pass = received < expected;
    const message = () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      `Expected:${isNot ? ' not' : ''} < ${printExpected(expected)}\n` +
      `Received:${isNot ? '    ' : ''}   ${printReceived(received)}`;

    return { message, pass };
  },

  toBeLessThanOrEqual(received: number | bigint, expected: number | bigint) {
    const matcherName = 'toBeLessThanOrEqual';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { isNot, promise: this.promise };
    ensureNumbers(received, expected, matcherName, options);

    const pass = received <= expected;
    const message = () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      `Expected:${isNot ? ' not' : ''} <= ${printExpected(expected)}\n` +
      `Received:${isNot ? '    ' : ''}    ${printReceived(received)}`;

    return { message, pass };
  },

  toBeNaN(received: any, expected: void) {
    const matcherName = 'toBeNaN';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };
    ensureNoExpected(expected, matcherName, options);

    const pass = Number.isNaN(received);
    const message = () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

    return { message, pass };
  },

  toBeNull(received: unknown, expected: void) {
    const matcherName = 'toBeNull';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };
    ensureNoExpected(expected, matcherName, options);

    const pass = received === null;
    const message = () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

    return { message, pass };
  },

  toBeTruthy(received: unknown, expected: void) {
    const matcherName = 'toBeTruthy';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };
    ensureNoExpected(expected, matcherName, options);

    const pass = !!received;
    const message = () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

    return { message, pass };
  },

  toBeUndefined(received: unknown, expected: void) {
    const matcherName = 'toBeUndefined';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };
    ensureNoExpected(expected, matcherName, options);

    const pass = received === void 0;
    const message = () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      `Received: ${printReceived(received)}`;

    return { message, pass };
  },

  toContain(received: ContainIterable | string, expected: unknown) {
    const matcherName = 'toContain';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { comment: 'indexOf', isNot, promise: this.promise };

    if (received === null || received === undefined) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must not be null nor undefined`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    if (typeof received === 'string') {
      const wrongTypeErrorMessage = `${EXPECTED_COLOR('expected')} value must be a string if ${RECEIVED_COLOR('received')} value is a string`;

      if (typeof expected !== 'string') {
        throw new TypeError(
            matcherErrorMessage(
                matcherHint(matcherName, received, String(expected), options),
                wrongTypeErrorMessage,
                printWithType('Expected', expected, printExpected) +
              '\n' +
              printWithType('Received', received, printReceived),
            ),
        );
      }

      const index = received.indexOf(String(expected));
      const pass = index !== -1;

      const message = () => {
        const labelExpected = `Expected ${typeof expected === 'string' ? 'substring' : 'value'}`;
        const labelReceived = 'Received string';
        const printLabel = getLabelPrinter(labelExpected, labelReceived);

        return (
          matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(expected)}\n` +
          `${printLabel(labelReceived)}${isNot ? '    ' : ''}${
            isNot
              ? printReceivedStringContainExpectedSubstring(received, index, String(expected).length)
              : printReceived(received)
          }`
        );
      };

      return { message, pass };
    }

    const indexable = [...received];
    const index = indexable.indexOf(expected);
    const pass = index !== -1;

    const message = () => {
      const labelExpected = 'Expected value';
      const labelReceived = `Received ${getType(received)}`;
      const printLabel = getLabelPrinter(labelExpected, labelReceived);

      return (
        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(expected)}\n` +
        `${printLabel(labelReceived)}${isNot ? '    ' : ''}${
          isNot && Array.isArray(received)
            ? printReceivedArrayContainExpectedItem(received, index)
            : printReceived(received)
        }` +
        (!isNot &&
        indexable.some(item =>
          equals(item, expected, [...this.customTesters, iterableEquality]),
        )
          ? `\n\n${SUGGEST_TO_CONTAIN_EQUAL}`
          : '')
      );
    };

    return { message, pass };
  },

  toContainEqual(received: ContainIterable, expected: unknown) {
    const matcherName = 'toContainEqual';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { comment: 'deep equality', isNot, promise: this.promise };

    if (received === null || received === undefined) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must not be null nor undefined`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    const index = [...received].findIndex(item =>
      equals(item, expected, [...this.customTesters, iterableEquality]),
    );
    const pass = index !== -1;

    const message = () => {
      const labelExpected = 'Expected value';
      const labelReceived = `Received ${getType(received)}`;
      const printLabel = getLabelPrinter(labelExpected, labelReceived);

      return (
        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(expected)}\n` +
        `${printLabel(labelReceived)}${isNot ? '    ' : ''}${
          isNot && Array.isArray(received)
            ? printReceivedArrayContainExpectedItem(received, index)
            : printReceived(received)
        }`
      );
    };

    return { message, pass };
  },

  toEqual(received: unknown, expected: unknown) {
    const matcherName = 'toEqual';
    const options: MatcherHintOptions = { comment: 'deep equality', isNot: this.isNot, promise: this.promise };

    const pass = equals(received, expected, [...this.customTesters, iterableEquality]);

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: not ${printExpected(expected)}\n` +
          (stringify(expected) === stringify(received)
            ? ''
            : `Received:     ${printReceived(received)}`)
      : () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          printDiffOrStringify(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, false);

    return { actual: received, expected, message, name: matcherName, pass };
  },

  toHaveLength(received: any, expected: number) {
    const matcherName = 'toHaveLength';
    const isNot = this.isNot;
    const options: MatcherHintOptions = { isNot, promise: this.promise };

    if (typeof received?.length !== 'number') {
      throw new TypeError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must have a length property whose value must be a number`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    ensureExpectedIsNonNegativeInteger(expected, matcherName, options);

    const pass = received.length === expected;

    const message = () => {
      const labelExpected = 'Expected length';
      const labelReceivedLength = 'Received length';
      const labelReceivedValue = `Received ${getType(received)}`;
      const printLabel = getLabelPrinter(labelExpected, labelReceivedLength, labelReceivedValue);

      return (
        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(expected)}\n` +
        (isNot ? '' : `${printLabel(labelReceivedLength)}${printReceived(received.length)}\n`) +
        `${printLabel(labelReceivedValue)}${isNot ? '    ' : ''}${printReceived(received)}`
      );
    };

    return { message, pass };
  },

  toHaveProperty(received: object, expectedPath: string | Array<string>, expectedValue?: unknown) {
    const matcherName = 'toHaveProperty';
    const expectedArgument = 'path';
    const hasValue = arguments.length === 3;
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
      secondArgument: hasValue ? 'value' : '',
    };

    if (received === null || received === undefined) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, expectedArgument, options),
              `${RECEIVED_COLOR('received')} value must not be null nor undefined`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    const expectedPathType = getType(expectedPath);

    if (expectedPathType !== 'string' && expectedPathType !== 'array') {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, expectedArgument, options),
              `${EXPECTED_COLOR('expected')} path must be a string or array`,
              printWithType('Expected', expectedPath, printExpected),
          ),
      );
    }

    const expectedPathLength =
      typeof expectedPath === 'string' ? pathAsArray(expectedPath).length : expectedPath.length;

    if (expectedPathType === 'array' && expectedPathLength === 0) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, expectedArgument, options),
              `${EXPECTED_COLOR('expected')} path must not be an empty array`,
              printWithType('Expected', expectedPath, printExpected),
          ),
      );
    }

    const result = getPath(received, expectedPath);
    const { lastTraversedObject, endPropIsDefined, hasEndProp, value } = result;
    const receivedPath = result.traversedPath;
    const hasCompletePath = receivedPath.length === expectedPathLength;
    const receivedValue = hasCompletePath ? result.value : lastTraversedObject;

    const pass =
      hasValue && endPropIsDefined
        ? equals(value, expectedValue, [...this.customTesters, iterableEquality])
        : Boolean(hasEndProp);

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, expectedArgument, options) +
          '\n\n' +
          (hasValue
            ? `Expected path: ${printExpected(expectedPath)}\n\n` +
              `Expected value: not ${printExpected(expectedValue)}${
                stringify(expectedValue) === stringify(receivedValue)
                  ? ''
                  : `\nReceived value:     ${printReceived(receivedValue)}`
              }`
            : `Expected path: not ${printExpected(expectedPath)}\n\n` +
              `Received value: ${printReceived(receivedValue)}`)
      : () =>
        matcherHint(matcherName, undefined, expectedArgument, options) +
          '\n\n' +
          `Expected path: ${printExpected(expectedPath)}\n` +
          (hasCompletePath
            ? `\n${printDiffOrStringify(
                expectedValue,
                receivedValue,
                EXPECTED_VALUE_LABEL,
                RECEIVED_VALUE_LABEL,
                false,
            )}`
            : `Received path: ${printReceived(
                expectedPathType === 'array' || receivedPath.length === 0
                  ? receivedPath
                  : receivedPath.join('.'),
            )}\n\n${
              hasValue ? `Expected value: ${printExpected(expectedValue)}\n` : ''
            }Received value: ${printReceived(receivedValue)}`);

    return { message, pass };
  },

  toMatch(received: string, expected: string | RegExp) {
    const matcherName = 'toMatch';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };

    if (typeof received !== 'string') {
      throw new TypeError(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must be a string`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    if (!(typeof expected === 'string') && !(expected && typeof expected.test === 'function')) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${EXPECTED_COLOR('expected')} value must be a string or regular expression`,
              printWithType('Expected', expected, printExpected),
          ),
      );
    }

    const pass =
      typeof expected === 'string'
        ? received.includes(expected)
        : new RegExp(expected).test(received);

    const message = pass
      ? () =>
        typeof expected === 'string'
          ? matcherHint(matcherName, undefined, undefined, options) +
              '\n\n' +
              `Expected substring: not ${printExpected(expected)}\n` +
              `Received string:        ${printReceivedStringContainExpectedSubstring(
                  received,
                  received.indexOf(expected),
                  expected.length,
              )}`
          : matcherHint(matcherName, undefined, undefined, options) +
              '\n\n' +
              `Expected pattern: not ${printExpected(expected)}\n` +
              `Received string:      ${printReceivedStringContainExpectedResult(
                  received,
                  typeof expected.exec === 'function' ? expected.exec(received) : null,
              )}`
      : () => {
        const labelExpected = `Expected ${typeof expected === 'string' ? 'substring' : 'pattern'}`;
        const labelReceived = 'Received string';
        const printLabel = getLabelPrinter(labelExpected, labelReceived);

        return (
          matcherHint(matcherName, undefined, undefined, options) +
            '\n\n' +
            `${printLabel(labelExpected)}${printExpected(expected)}\n` +
            `${printLabel(labelReceived)}${printReceived(received)}`
        );
      };

    return { message, pass };
  },

  toMatchObject(received: object, expected: object) {
    const matcherName = 'toMatchObject';
    const options: MatcherHintOptions = { isNot: this.isNot, promise: this.promise };

    if (typeof received !== 'object' || received === null) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must be a non-null object`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    if (typeof expected !== 'object' || expected === null) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${EXPECTED_COLOR('expected')} value must be a non-null object`,
              printWithType('Expected', expected, printExpected),
          ),
      );
    }

    const pass = equals(received, expected, [...this.customTesters, iterableEquality, subsetEquality]);

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: not ${printExpected(expected)}` +
          (stringify(expected) === stringify(received)
            ? ''
            : `\nReceived:     ${printReceived(received)}`)
      : () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          printDiffOrStringify(
              expected,
              getObjectSubset(received, expected, this.customTesters),
              EXPECTED_LABEL,
              RECEIVED_LABEL,
              false,
          );

    return { message, pass };
  },

  toStrictEqual(received: unknown, expected: unknown) {
    const matcherName = 'toStrictEqual';
    const options: MatcherHintOptions = { comment: 'deep equality', isNot: this.isNot, promise: this.promise };

    const pass = equals(received, expected, [...this.customTesters, ...toStrictEqualTesters], true);

    const message = pass
      ? () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected: not ${printExpected(expected)}\n` +
          (stringify(expected) === stringify(received)
            ? ''
            : `Received:     ${printReceived(received)}`)
      : () =>
        matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          printDiffOrStringify(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, false);

    return { actual: received, expected, message, name: matcherName, pass };
  },
};

// -----------------------------------------------------------------------------
// toThrow matcher (toThrowMatchers.ts)
// -----------------------------------------------------------------------------

const DID_NOT_THROW = 'Received function did not throw';

type Thrown =
  | { hasMessage: true; isError: true; message: string; value: Error }
  | { hasMessage: boolean; isError: false; message: string; value: any };

const getThrown = (e: any): Thrown => {
  const hasMessage = e !== null && e !== undefined && typeof e.message === 'string';

  if (hasMessage && typeof e.name === 'string' && typeof e.stack === 'string')
    return { hasMessage, isError: true, message: e.message, value: e };

  return {
    hasMessage,
    isError: false,
    message: hasMessage ? e.message : String(e),
    value: e,
  };
};

export const createThrowMatcher = (matcherName: string, fromPromise?: boolean): RawMatcherFn =>
  function(this: MatcherContext, received: any, expected: any): ExpectationResult {
    const options = { isNot: this.isNot, promise: this.promise };

    let thrown: Thrown | null = null;

    if (fromPromise && isError(received)) {
      thrown = getThrown(received);
    } else {
      if (typeof received === 'function') {
        try {
          received();
        } catch (error) {
          thrown = getThrown(error);
        }
      } else if (!fromPromise) {
        const placeholder = expected === undefined ? '' : 'expected';
        throw new Error(
            matcherErrorMessage(
                matcherHint(matcherName, undefined, placeholder, options),
                `${RECEIVED_COLOR('received')} value must be a function`,
                printWithType('Received', received, printReceived),
            ),
        );
      }
    }

    if (expected === undefined)
      return toThrow(matcherName, options, thrown);
    if (typeof expected === 'function')
      return toThrowExpectedClass(matcherName, options, thrown, expected);
    if (typeof expected === 'string')
      return toThrowExpectedString(matcherName, options, thrown, expected);
    if (expected !== null && typeof expected.test === 'function')
      return toThrowExpectedRegExp(matcherName, options, thrown, expected);
    if (expected !== null && typeof expected.asymmetricMatch === 'function')
      return toThrowExpectedAsymmetric(matcherName, options, thrown, expected);
    if (expected !== null && typeof expected === 'object')
      return toThrowExpectedObject(matcherName, options, thrown, expected);
    throw new Error(
        matcherErrorMessage(
            matcherHint(matcherName, undefined, undefined, options),
            `${EXPECTED_COLOR('expected')} value must be a string or regular expression or class or error`,
            printWithType('Expected', expected, printExpected),
        ),
    );
  };

const toThrowExpectedRegExp = (
  matcherName: string,
  options: MatcherHintOptions,
  thrown: Thrown | null,
  expected: RegExp,
): SyncExpectationResult => {
  const pass = thrown !== null && expected.test(thrown.message);

  const message = pass
    ? () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected('Expected pattern: not ', expected) +
      (thrown !== null && thrown.hasMessage
        ? formatReceived('Received message:     ', thrown, 'message', expected) + formatStack(thrown)
        : formatReceived('Received value:       ', thrown, 'value'))
    : () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected('Expected pattern: ', expected) +
      (thrown === null
        ? `\n${DID_NOT_THROW}`
        : thrown.hasMessage
          ? formatReceived('Received message: ', thrown, 'message') + formatStack(thrown)
          : formatReceived('Received value:   ', thrown, 'value'));

  return { message, pass };
};

type AsymmetricMatcherExpected = { asymmetricMatch: (received: unknown) => boolean };

const toThrowExpectedAsymmetric = (
  matcherName: string,
  options: MatcherHintOptions,
  thrown: Thrown | null,
  expected: AsymmetricMatcherExpected,
): SyncExpectationResult => {
  const pass = thrown !== null && expected.asymmetricMatch(thrown.value);

  const message = pass
    ? () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected('Expected asymmetric matcher: not ', expected) +
      '\n' +
      (thrown !== null && thrown.hasMessage
        ? formatReceived('Received name:    ', thrown, 'name') +
          formatReceived('Received message: ', thrown, 'message') +
          formatStack(thrown)
        : formatReceived('Thrown value: ', thrown, 'value'))
    : () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected('Expected asymmetric matcher: ', expected) +
      '\n' +
      (thrown === null
        ? DID_NOT_THROW
        : thrown.hasMessage
          ? formatReceived('Received name:    ', thrown, 'name') +
            formatReceived('Received message: ', thrown, 'message') +
            formatStack(thrown)
          : formatReceived('Thrown value: ', thrown, 'value'));

  return { message, pass };
};

const toThrowExpectedObject = (
  matcherName: string,
  options: MatcherHintOptions,
  thrown: Thrown | null,
  expected: Error,
): SyncExpectationResult => {
  const expectedMessageAndCause = createMessageAndCause(expected);
  const thrownMessageAndCause = thrown === null ? null : createMessageAndCause(thrown.value);
  const isCompareErrorInstance = thrown?.isError && expected instanceof Error;
  const isExpectedCustomErrorInstance = expected.constructor.name !== Error.name;

  const pass =
    thrown !== null &&
    thrown.message === expected.message &&
    thrownMessageAndCause === expectedMessageAndCause &&
    (!isCompareErrorInstance || !isExpectedCustomErrorInstance || thrown.value instanceof expected.constructor);

  const message = pass
    ? () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected(`Expected ${messageAndCause(expected)}: not `, expectedMessageAndCause) +
      (thrown !== null && thrown.hasMessage
        ? formatStack(thrown)
        : formatReceived('Received value:       ', thrown, 'value'))
    : () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      (thrown === null
        ? formatExpected(`Expected ${messageAndCause(expected)}: `, expectedMessageAndCause) +
          '\n' +
          DID_NOT_THROW
        : thrown.hasMessage
          ? printDiffOrStringify(
              expectedMessageAndCause,
              thrownMessageAndCause,
              `Expected ${messageAndCause(expected)}`,
              `Received ${messageAndCause(thrown.value)}`,
              true,
          ) +
            '\n' +
            formatStack(thrown)
          : formatExpected(`Expected ${messageAndCause(expected)}: `, expectedMessageAndCause) +
            formatReceived('Received value:   ', thrown, 'value'));

  return { message, pass };
};

const toThrowExpectedClass = (
  matcherName: string,
  options: MatcherHintOptions,
  thrown: Thrown | null,
  expected: Function,
): SyncExpectationResult => {
  const pass = thrown !== null && thrown.value instanceof expected;

  const message = pass
    ? () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      printExpectedConstructorNameNot('Expected constructor', expected) +
      (thrown !== null &&
      thrown.value !== null && thrown.value !== undefined &&
      typeof thrown.value.constructor === 'function' &&
      thrown.value.constructor !== expected
        ? printReceivedConstructorNameNot('Received constructor', thrown.value.constructor, expected)
        : '') +
      '\n' +
      (thrown !== null && thrown.hasMessage
        ? formatReceived('Received message: ', thrown, 'message') + formatStack(thrown)
        : formatReceived('Received value: ', thrown, 'value'))
    : () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      printExpectedConstructorName('Expected constructor', expected) +
      (thrown === null
        ? `\n${DID_NOT_THROW}`
        : `${
          thrown.value !== null && thrown.value !== undefined && typeof thrown.value.constructor === 'function'
            ? printReceivedConstructorName('Received constructor', thrown.value.constructor)
            : ''
        }\n${
          thrown.hasMessage
            ? formatReceived('Received message: ', thrown, 'message') + formatStack(thrown)
            : formatReceived('Received value: ', thrown, 'value')
        }`);

  return { message, pass };
};

const toThrowExpectedString = (
  matcherName: string,
  options: MatcherHintOptions,
  thrown: Thrown | null,
  expected: string,
): SyncExpectationResult => {
  const pass = thrown !== null && thrown.message.includes(expected);

  const message = pass
    ? () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected('Expected substring: not ', expected) +
      (thrown !== null && thrown.hasMessage
        ? formatReceived('Received message:       ', thrown, 'message', expected) + formatStack(thrown)
        : formatReceived('Received value:         ', thrown, 'value'))
    : () =>
      matcherHint(matcherName, undefined, undefined, options) +
      '\n\n' +
      formatExpected('Expected substring: ', expected) +
      (thrown === null
        ? `\n${DID_NOT_THROW}`
        : thrown.hasMessage
          ? formatReceived('Received message:   ', thrown, 'message') + formatStack(thrown)
          : formatReceived('Received value:     ', thrown, 'value'));

  return { message, pass };
};

const toThrow = (
  matcherName: string,
  options: MatcherHintOptions,
  thrown: Thrown | null,
): SyncExpectationResult => {
  const pass = thrown !== null;

  const message = pass
    ? () =>
      matcherHint(matcherName, undefined, '', options) +
      '\n\n' +
      (thrown !== null && thrown.hasMessage
        ? formatReceived('Error name:    ', thrown, 'name') +
          formatReceived('Error message: ', thrown, 'message') +
          formatStack(thrown)
        : formatReceived('Thrown value: ', thrown, 'value'))
    : () =>
      matcherHint(matcherName, undefined, '', options) + '\n\n' + DID_NOT_THROW;

  return { message, pass };
};

const formatExpected = (label: string, expected: unknown) =>
  `${label + printExpected(expected)}\n`;

const formatReceived = (
  label: string,
  thrown: Thrown | null,
  key: string,
  expected?: string | RegExp,
) => {
  if (thrown === null)
    return '';

  if (key === 'message') {
    const message = thrown.message;

    if (typeof expected === 'string') {
      const index = message.indexOf(expected);
      if (index !== -1) {
        return `${
          label + printReceivedStringContainExpectedSubstring(message, index, expected.length)
        }\n`;
      }
    } else if (expected instanceof RegExp) {
      return `${
        label +
        printReceivedStringContainExpectedResult(
            message,
            typeof expected.exec === 'function' ? expected.exec(message) : null,
        )
      }\n`;
    }

    return `${label + printReceived(message)}\n`;
  }

  if (key === 'name')
    return thrown.isError ? `${label + printReceived(thrown.value.name)}\n` : '';

  if (key === 'value')
    return thrown.isError ? '' : `${label + printReceived(thrown.value)}\n`;

  return '';
};

const formatStack = (thrown: Thrown | null) => {
  if (thrown === null || !thrown.isError)
    return '';
  const config = { rootDir: process.cwd(), testMatch: [] };
  const options = { noStackTrace: false };
  if (thrown.value instanceof AggregateError)
    return formatExecError(thrown.value, config, options);
  return formatStackTrace(
      separateMessageFromStack(thrown.value.stack!).stack,
      config,
      options,
  );
};

function createMessageAndCause(error: Error) {
  if (error.cause) {
    const seen = new WeakSet();
    return JSON.stringify(buildSerializeError(error), (_, value) => {
      if (isObject(value)) {
        if (seen.has(value))
          return;
        seen.add(value);
      }
      if (typeof value === 'bigint' || value === undefined)
        return String(value);
      return value;
    });
  }

  return error.message;
}

function buildSerializeError(error: { [key: string]: any }): any {
  if (!isObject(error))
    return error;

  const result: { [key: string]: any } = {};
  for (const name of Object.getOwnPropertyNames(error).sort()) {
    if (['stack', 'fileName', 'lineNumber'].includes(name))
      continue;
    if (name === 'cause') {
      result[name] = buildSerializeError(error['cause']);
      continue;
    }
    result[name] = error[name];
  }

  return result;
}

function isObject(obj: unknown) {
  return obj !== null && obj !== undefined && typeof obj === 'object';
}

function messageAndCause(error: Error) {
  return error.cause === undefined ? 'message' : 'message and cause';
}

export const getMessage = (message?: () => string) =>
  (message && message()) ||
  RECEIVED_COLOR('No message was specified for this matcher.');

export const validateMatcherResult = (result: any) => {
  if (
    typeof result !== 'object' ||
    typeof result.pass !== 'boolean' ||
    (result.message &&
      typeof result.message !== 'string' &&
      typeof result.message !== 'function')
  ) {
    throw new Error(
        'Unexpected return from a matcher function.\n' +
        'Matcher functions should ' +
        'return an object in the following format:\n' +
        '  {message?: string | function, pass: boolean}\n' +
        `'${stringify(result)}' was returned`,
    );
  }
};
