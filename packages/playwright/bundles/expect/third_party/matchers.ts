/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable eqeqeq */

import {
  arrayBufferEquality,
  equals,
  getObjectSubset,
  getPath,
  iterableEquality,
  pathAsArray,
  sparseArrayEquality,
  subsetEquality,
  typeEquality,
} from '@jest/expect-utils';
import { getType, isPrimitive } from 'jest-get-type';
import {
  DIM_COLOR,
  EXPECTED_COLOR,
  type MatcherHintOptions,
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
import {
  printCloseTo,
  printExpectedConstructorName,
  printExpectedConstructorNameNot,
  printReceivedArrayContainExpectedItem,
  printReceivedConstructorName,
  printReceivedConstructorNameNot,
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring,
} from './print';
import type { MatchersObject } from './types';

// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';
const EXPECTED_VALUE_LABEL = 'Expected value';
const RECEIVED_VALUE_LABEL = 'Received value';

// The optional property of matcher context is true if undefined.
const isExpand = (expand?: boolean): boolean => expand !== false;

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

const matchers: MatchersObject = {
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
          // If deep equality passes when referential identity fails,
          // but exclude map and set until review of their equality logic.
          if (
            equals(
                received,
                expected,
                [...this.customTesters, ...toStrictEqualTesters],
                true,
            )
          )
            deepEqualityName = 'toStrictEqual';
          else if (
            equals(received, expected, [
              ...this.customTesters,
              iterableEquality,
            ])
          )
            deepEqualityName = 'toEqual';

        }

        return (

          matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          (deepEqualityName !== null
            ? `${DIM_COLOR(
                `If it should pass with deep equality, replace "${matcherName}" with "${deepEqualityName}"`,
            )}\n\n`
            : '') +
          printDiffOrStringify(
              expected,
              received,
              EXPECTED_LABEL,
              RECEIVED_LABEL,
              isExpand(this.expand),
          )
        );
      };

    // Passing the actual and expected objects so that a custom reporter
    // could access them, for example in order to display a custom visual diff,
    // or create a different error message
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
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${EXPECTED_COLOR('expected')} value must be a number`,
              printWithType('Expected', expected, printExpected),
          ),
      );
    }

    if (typeof received !== 'number') {
      throw new Error(
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

    if (received === Infinity && expected === Infinity) {
      pass = true; // Infinity - Infinity is NaN
    } else if (received === -Infinity && expected === -Infinity) {
      pass = true; // -Infinity - -Infinity is NaN
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };

    if (typeof expected !== 'function') {
      throw new Error(
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
        (typeof received.constructor === 'function' &&
          received.constructor !== expected
          ? printReceivedConstructorNameNot(
              'Received constructor',
              received.constructor,
              expected,
          )
          : '')
      : () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        printExpectedConstructorName('Expected constructor', expected) +
        (isPrimitive(received) || Object.getPrototypeOf(received) === null
          ? `\nReceived value has no prototype\nReceived value: ${printReceived(
              received,
          )}`
          : typeof received.constructor !== 'function'
            ? `\nReceived value: ${printReceived(received)}`
            : printReceivedConstructorName(
                'Received constructor',
                received.constructor,
            ));

    return { message, pass };
  },

  toBeLessThan(received: number | bigint, expected: number | bigint) {
    const matcherName = 'toBeLessThan';
    const isNot = this.isNot;
    const options: MatcherHintOptions = {
      isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };
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
    const options: MatcherHintOptions = {
      comment: 'indexOf',
      isNot,
      promise: this.promise,
    };

    if (received == null) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must not be null nor undefined`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    if (typeof received === 'string') {
      const wrongTypeErrorMessage = `${EXPECTED_COLOR(
          'expected',
      )} value must be a string if ${RECEIVED_COLOR(
          'received',
      )} value is a string`;

      if (typeof expected !== 'string') {
        throw new Error(
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
        const labelExpected = `Expected ${typeof expected === 'string' ? 'substring' : 'value'
        }`;
        const labelReceived = 'Received string';
        const printLabel = getLabelPrinter(labelExpected, labelReceived);

        return (

          matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(
              expected,
          )}\n` +
          `${printLabel(labelReceived)}${isNot ? '    ' : ''}${isNot
            ? printReceivedStringContainExpectedSubstring(
                received,
                index,
                String(expected).length,
            )
            : printReceived(received)
          }`
        );
      };

      return { message, pass };
    }

    const indexable = Array.from(received);
    const index = indexable.indexOf(expected);
    const pass = index !== -1;

    const message = () => {
      const labelExpected = 'Expected value';
      const labelReceived = `Received ${getType(received)}`;
      const printLabel = getLabelPrinter(labelExpected, labelReceived);

      return (

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(
            expected,
        )}\n` +
        `${printLabel(labelReceived)}${isNot ? '    ' : ''}${isNot && Array.isArray(received)
          ? printReceivedArrayContainExpectedItem(received, index)
          : printReceived(received)
        }` +
        (!isNot &&
          indexable.findIndex(item =>
            equals(item, expected, [...this.customTesters, iterableEquality]),
          ) !== -1
          ? `\n\n${SUGGEST_TO_CONTAIN_EQUAL}`
          : '')
      );
    };

    return { message, pass };
  },

  toContainEqual(received: ContainIterable, expected: unknown) {
    const matcherName = 'toContainEqual';
    const isNot = this.isNot;
    const options: MatcherHintOptions = {
      comment: 'deep equality',
      isNot,
      promise: this.promise,
    };

    if (received == null) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must not be null nor undefined`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    const index = Array.from(received).findIndex(item =>
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
        `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(
            expected,
        )}\n` +
        `${printLabel(labelReceived)}${isNot ? '    ' : ''}${isNot && Array.isArray(received)
          ? printReceivedArrayContainExpectedItem(received, index)
          : printReceived(received)
        }`
      );
    };

    return { message, pass };
  },

  toEqual(received: unknown, expected: unknown) {
    const matcherName = 'toEqual';
    const options: MatcherHintOptions = {
      comment: 'deep equality',
      isNot: this.isNot,
      promise: this.promise,
    };

    const pass = equals(received, expected, [
      ...this.customTesters,
      iterableEquality,
    ]);

    const message = pass
      ? () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `Expected: not ${printExpected(expected)}\n` +
        (stringify(expected) !== stringify(received)
          ? `Received:     ${printReceived(received)}`
          : '')
      : () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        printDiffOrStringify(
            expected,
            received,
            EXPECTED_LABEL,
            RECEIVED_LABEL,
            isExpand(this.expand),
        );

    // Passing the actual and expected objects so that a custom reporter
    // could access them, for example in order to display a custom visual diff,
    // or create a different error message
    return { actual: received, expected, message, name: matcherName, pass };
  },

  toHaveLength(received: any, expected: number) {
    const matcherName = 'toHaveLength';
    const isNot = this.isNot;
    const options: MatcherHintOptions = {
      isNot,
      promise: this.promise,
    };

    if (typeof received?.length !== 'number') {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR(
                  'received',
              )} value must have a length property whose value must be a number`,
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
      const printLabel = getLabelPrinter(
          labelExpected,
          labelReceivedLength,
          labelReceivedValue,
      );

      return (

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `${printLabel(labelExpected)}${isNot ? 'not ' : ''}${printExpected(
            expected,
        )}\n` +
        (isNot
          ? ''
          : `${printLabel(labelReceivedLength)}${printReceived(
              received.length,
          )}\n`) +
        `${printLabel(labelReceivedValue)}${isNot ? '    ' : ''}${printReceived(
            received,
        )}`
      );
    };

    return { message, pass };
  },

  toHaveProperty(
    received: object,
    expectedPath: string | Array<string>,
    expectedValue?: unknown,
  ) {
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
      typeof expectedPath === 'string'
        ? pathAsArray(expectedPath).length
        : expectedPath.length;

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
        ? equals(value, expectedValue, [
          ...this.customTesters,
          iterableEquality,
        ])
        : Boolean(hasEndProp);

    const message = pass
      ? () =>

        matcherHint(matcherName, undefined, expectedArgument, options) +
        '\n\n' +
        (hasValue
          ? `Expected path: ${printExpected(expectedPath)}\n\n` +
          `Expected value: not ${printExpected(expectedValue)}${stringify(expectedValue) !== stringify(receivedValue)
            ? `\nReceived value:     ${printReceived(receivedValue)}`
            : ''
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
              isExpand(this.expand),
          )}`
          : `Received path: ${printReceived(
              expectedPathType === 'array' || receivedPath.length === 0
                ? receivedPath
                : receivedPath.join('.'),
          )}\n\n${hasValue
            ? `Expected value: ${printExpected(expectedValue)}\n`
            : ''
          }Received value: ${printReceived(receivedValue)}`);

    return { message, pass };
  },

  toMatch(received: string, expected: string | RegExp) {
    const matcherName = 'toMatch';
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };

    if (typeof received !== 'string') {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${RECEIVED_COLOR('received')} value must be a string`,
              printWithType('Received', received, printReceived),
          ),
      );
    }

    if (
      !(typeof expected === 'string') &&
      !(expected && typeof expected.test === 'function')
    ) {
      throw new Error(
          matcherErrorMessage(
              matcherHint(matcherName, undefined, undefined, options),
              `${EXPECTED_COLOR(
                  'expected',
              )} value must be a string or regular expression`,
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
          ?
          matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected substring: not ${printExpected(expected)}\n` +
          `Received string:        ${printReceivedStringContainExpectedSubstring(
              received,
              received.indexOf(expected),
              expected.length,
          )}`
          :
          matcherHint(matcherName, undefined, undefined, options) +
          '\n\n' +
          `Expected pattern: not ${printExpected(expected)}\n` +
          `Received string:      ${printReceivedStringContainExpectedResult(
              received,
              typeof expected.exec === 'function'
                ? expected.exec(received)
                : null,
          )}`
      : () => {
        const labelExpected = `Expected ${typeof expected === 'string' ? 'substring' : 'pattern'
        }`;
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
    const options: MatcherHintOptions = {
      isNot: this.isNot,
      promise: this.promise,
    };

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

    const pass = equals(received, expected, [
      ...this.customTesters,
      iterableEquality,
      subsetEquality,
    ]);

    const message = pass
      ? () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `Expected: not ${printExpected(expected)}` +
        (stringify(expected) !== stringify(received)
          ? `\nReceived:     ${printReceived(received)}`
          : '')
      : () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        printDiffOrStringify(
            expected,
            getObjectSubset(received, expected, this.customTesters),
            EXPECTED_LABEL,
            RECEIVED_LABEL,
            isExpand(this.expand),
        );

    return { message, pass };
  },

  toStrictEqual(received: unknown, expected: unknown) {
    const matcherName = 'toStrictEqual';
    const options: MatcherHintOptions = {
      comment: 'deep equality',
      isNot: this.isNot,
      promise: this.promise,
    };

    const pass = equals(
        received,
        expected,
        [...this.customTesters, ...toStrictEqualTesters],
        true,
    );

    const message = pass
      ? () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        `Expected: not ${printExpected(expected)}\n` +
        (stringify(expected) !== stringify(received)
          ? `Received:     ${printReceived(received)}`
          : '')
      : () =>

        matcherHint(matcherName, undefined, undefined, options) +
        '\n\n' +
        printDiffOrStringify(
            expected,
            received,
            EXPECTED_LABEL,
            RECEIVED_LABEL,
            isExpand(this.expand),
        );

    // Passing the actual and expected objects so that a custom reporter
    // could access them, for example in order to display a custom visual diff,
    // or create a different error message
    return { actual: received, expected, message, name: matcherName, pass };
  },
};

export default matchers;
