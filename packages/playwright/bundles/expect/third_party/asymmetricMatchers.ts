/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  equals,
  getObjectKeys,
  isA,
  iterableEquality,
  subsetEquality,
} from '@jest/expect-utils';
import * as matcherUtils from 'jest-matcher-utils';
import { pluralize } from 'jest-util';

import { getCustomEqualityTesters, getState } from './jestMatchersObject';

import type {
  AsymmetricMatcher as AsymmetricMatcherInterface,
  MatcherContext,
  MatcherState,
} from './types';

const functionToString = Function.prototype.toString;

function fnNameFor(func: () => unknown) {
  if (func.name)
    return func.name;

  const matches = functionToString
      .call(func)
      .match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/);
  return matches ? matches[1] : '<anonymous>';
}

const utils = Object.freeze({
  ...matcherUtils,
  iterableEquality,
  subsetEquality,
});

function getPrototype(obj: object) {
  if (Object.getPrototypeOf)
    return Object.getPrototypeOf(obj);

  if (obj.constructor.prototype === obj)
    return null;

  return obj.constructor.prototype;
}

export function hasProperty(
  obj: object | null,
  property: string | symbol,
): boolean {
  if (!obj)
    return false;

  if (Object.prototype.hasOwnProperty.call(obj, property))
    return true;

  return hasProperty(getPrototype(obj), property);
}

export abstract class AsymmetricMatcher<T>
implements AsymmetricMatcherInterface {
  $$typeof = Symbol.for('jest.asymmetricMatcher');

  constructor(protected sample: T, protected inverse = false) { }

  protected getMatcherContext(): MatcherContext {
    return {
      customTesters: getCustomEqualityTesters(),

      dontThrow: () => { },
      ...getState<MatcherState>(),
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

class Any extends AsymmetricMatcher<any> {
  constructor(sample: unknown) {
    if (typeof sample === 'undefined') {
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

    return fnNameFor(this.sample);
  }

  override toAsymmetricMatcher() {
    return `Any<${fnNameFor(this.sample)}>`;
  }
}

class Anything extends AsymmetricMatcher<void> {
  asymmetricMatch(other: unknown) {
    // eslint-disable-next-line eqeqeq
    return other != null;
  }

  toString() {
    return 'Anything';
  }

  // No getExpectedType method, because it matches either null or undefined.

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
      throw new Error(
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

class ObjectContaining extends AsymmetricMatcher<
  Record<string | symbol, unknown>
> {
  constructor(sample: Record<string | symbol, unknown>, inverse = false) {
    super(sample, inverse);
  }

  asymmetricMatch(other: any) {
    if (typeof this.sample !== 'object') {
      throw new Error(
          `You must provide an object to ${this.toString()}, not '${typeof this
              .sample}'.`,
      );
    }

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
    if (other === Infinity && this.sample === Infinity) {
      result = true; // Infinity - Infinity is NaN
    } else if (other === -Infinity && this.sample === -Infinity) {
      result = true; // -Infinity - -Infinity is NaN
    } else {
      result =
        Math.abs(this.sample - other) < Math.pow(10, -this.precision) / 2;
    }
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
      `(${pluralize('digit', this.precision)})`,
    ].join(' ');
  }
}

export const any = (expectedObject: unknown): Any => new Any(expectedObject);
export const anything = (): Anything => new Anything();
export const arrayContaining = (sample: Array<unknown>): ArrayContaining =>
  new ArrayContaining(sample);
export const arrayNotContaining = (sample: Array<unknown>): ArrayContaining =>
  new ArrayContaining(sample, true);
export const objectContaining = (
  sample: Record<string, unknown>,
): ObjectContaining => new ObjectContaining(sample);
export const objectNotContaining = (
  sample: Record<string, unknown>,
): ObjectContaining => new ObjectContaining(sample, true);
export const stringContaining = (expected: string): StringContaining =>
  new StringContaining(expected);
export const stringNotContaining = (expected: string): StringContaining =>
  new StringContaining(expected, true);
export const stringMatching = (expected: string | RegExp): StringMatching =>
  new StringMatching(expected);
export const stringNotMatching = (expected: string | RegExp): StringMatching =>
  new StringMatching(expected, true);
export const closeTo = (expected: number, precision?: number): CloseTo =>
  new CloseTo(expected, precision);
export const notCloseTo = (expected: number, precision?: number): CloseTo =>
  new CloseTo(expected, precision, true);
