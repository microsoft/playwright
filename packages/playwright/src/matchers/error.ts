/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ExpectMatcherState } from '../../types/test';
import { kNoElementsFoundError, matcherHint } from './matcherHint';
import { colors } from 'playwright-core/lib/utilsBundle';
import type { Locator } from 'playwright-core';
import { EXPECTED_COLOR, printReceived } from '../common/expectBundle';
import { printReceivedStringContainExpectedResult, printReceivedStringContainExpectedSubstring } from './expect';
import { callLogText } from '../util';

export function toMatchExpectedStringOrPredicateVerification(
  state: ExpectMatcherState,
  matcherName: string,
  receiver: Locator | undefined,
  expression: string | Locator | undefined,
  expected: string | RegExp | Function,
  supportsPredicate: boolean = false
): void {
  const matcherOptions = {
    isNot: state.isNot,
    promise: state.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && 'test' in expected && typeof expected.test === 'function') &&
    !(supportsPredicate && typeof expected === 'function')
  ) {
    // Same format as jest's matcherErrorMessage
    const message = supportsPredicate ? 'string, regular expression, or predicate' : 'string or regular expression';

    throw new Error([
      // Always display `expected` in expectation place
      matcherHint(state, receiver, matcherName, expression, undefined, matcherOptions),
      `${colors.bold('Matcher error')}: ${EXPECTED_COLOR('expected',)} value must be a ${message}`,
      state.utils.printWithType('Expected', expected, state.utils.printExpected)
    ].join('\n\n'));
  }
}

export function textMatcherMessage(state: ExpectMatcherState, matcherName: string, receiver: Locator | undefined, expression: string, expected: string | RegExp | Function, received: string | undefined, callLog: string[] | undefined, stringName: string, pass: boolean, didTimeout: boolean, timeout: number): string {
  const matcherOptions = {
    isNot: state.isNot,
    promise: state.promise,
  };
  const receivedString = received || '';
  const messagePrefix = matcherHint(state, receiver, matcherName, expression, undefined, matcherOptions, didTimeout ? timeout : undefined);
  const notFound = received === kNoElementsFoundError;

  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  let printedDiff: string | undefined;
  if (typeof expected === 'function') {
    printedExpected = `Expected predicate to ${!state.isNot ? 'succeed' : 'fail'}`;
    printedReceived = `Received string: ${printReceived(receivedString)}`;
  } else {
    if (pass) {
      if (typeof expected === 'string') {
        if (notFound) {
          printedExpected = `Expected ${stringName}: not ${state.utils.printExpected(expected)}`;
          printedReceived = `Received: ${received}`;
        } else {
          printedExpected = `Expected ${stringName}: not ${state.utils.printExpected(expected)}`;
          const formattedReceived = printReceivedStringContainExpectedSubstring(receivedString, receivedString.indexOf(expected), expected.length);
          printedReceived = `Received string: ${formattedReceived}`;
        }
      } else {
        if (notFound) {
          printedExpected = `Expected pattern: not ${state.utils.printExpected(expected)}`;
          printedReceived = `Received: ${received}`;
        } else {
          printedExpected = `Expected pattern: not ${state.utils.printExpected(expected)}`;
          const formattedReceived = printReceivedStringContainExpectedResult(receivedString, typeof expected.exec === 'function' ? expected.exec(receivedString) : null);
          printedReceived = `Received string: ${formattedReceived}`;
        }
      }
    } else {
      const labelExpected = `Expected ${typeof expected === 'string' ? stringName : 'pattern'}`;
      if (notFound) {
        printedExpected = `${labelExpected}: ${state.utils.printExpected(expected)}`;
        printedReceived = `Received: ${received}`;
      } else {
        printedDiff = state.utils.printDiffOrStringify(expected, receivedString, labelExpected, 'Received string', false);
      }
    }
  }

  const resultDetails = printedDiff ? printedDiff : printedExpected + '\n' + printedReceived;
  return messagePrefix + resultDetails + callLogText(callLog);
}
