/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { expectTypes, callLogText } from '../util';
import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring
} from './expect';
import { EXPECTED_COLOR } from '../common/expectBundle';
import type { ExpectMatcherState } from '../../types/test';
import { kNoElementsFoundError, matcherHint } from './matcherHint';
import type { MatcherResult } from './matcherHint';
import type { Locator } from 'playwright-core';
import { colors } from 'playwright-core/lib/utilsBundle';

export function toMatchExpectedStringVerification(
  state: ExpectMatcherState,
  matcherName: string,
  receiver: Locator | undefined,
  expression: string | Locator | undefined,
  expected: string | RegExp
): void {
  const matcherOptions = {
    isNot: state.isNot,
    promise: state.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && typeof expected.test === 'function')
  ) {
    throw new Error([
      // Always display `expected` in expectation place
      matcherHint(state, receiver, matcherName, expression, undefined, matcherOptions),
      `${colors.bold('Matcher error')}: ${EXPECTED_COLOR('expected',)} value must be a string or regular expression`,
      state.utils.printWithType('Expected', expected, state.utils.printExpected)
    ].join('\n\n'));
  }
}

export function textMatcherMessage(
  state: ExpectMatcherState,
  matcherName: string,
  receiver: Locator | undefined,
  expression: string,
  expected: string | RegExp,
  received: string | undefined,
  callLog: string[] | undefined,
  stringName: string,
  pass: boolean,
  didTimeout: boolean,
  timeout: number,
): string {
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

  const resultDetails = printedDiff ? printedDiff : printedExpected + '\n' + printedReceived;
  return messagePrefix + resultDetails + callLogText(callLog);
}

export async function toMatchText(
  this: ExpectMatcherState,
  matcherName: string,
  receiver: Locator,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: string, log?: string[], timedOut?: boolean }>,
  expected: string | RegExp,
  options: { timeout?: number, matchSubstring?: boolean } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  expectTypes(receiver, [receiverType], matcherName);
  toMatchExpectedStringVerification(this, matcherName, receiver, receiver, expected);

  const timeout = options.timeout ?? this.timeout;

  const { matches: pass, received, log, timedOut } = await query(!!this.isNot, timeout);
  if (pass === !this.isNot) {
    return {
      name: matcherName,
      message: () => '',
      pass,
      expected
    };
  }

  const stringSubstring = options.matchSubstring ? 'substring' : 'string';

  return {
    name: matcherName,
    expected,
    message: () =>
      textMatcherMessage(
          this,
          matcherName,
          receiver,
          'locator',
          expected,
          received,
          log,
          stringSubstring,
          pass,
          !!timedOut,
          timeout,
      ),
    pass,
    actual: received,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}
