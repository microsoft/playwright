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


import { colors } from 'playwright-core/lib/utils';

import { callLogText, expectTypes } from '../util';
import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring
} from './expect';
import { kNoElementsFoundError, matcherHint } from './matcherHint';
import { EXPECTED_COLOR } from '../common/expectBundle';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Page, Locator } from 'playwright-core';

export async function toMatchText(
  this: ExpectMatcherState,
  matcherName: string,
  receiver: Locator | Page,
  receiverType: 'Locator' | 'Page',
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: string, log?: string[], timedOut?: boolean }>,
  expected: string | RegExp,
  options: { timeout?: number, matchSubstring?: boolean, receiverLabel?: string } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  expectTypes(receiver, [receiverType], matcherName);

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && typeof expected.test === 'function')
  ) {
    // Same format as jest's matcherErrorMessage
    throw new Error([
      matcherHint(this, receiverType === 'Locator' ? receiver as Locator : undefined, matcherName, options.receiverLabel ?? receiver, expected, matcherOptions, undefined, undefined, true),
      `${colors.bold('Matcher error')}: ${EXPECTED_COLOR('expected',)} value must be a string or regular expression`,
      this.utils.printWithType('Expected', expected, this.utils.printExpected)
    ].join('\n\n'));
  }

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
  const receivedString = received || '';
  const notFound = received === kNoElementsFoundError;

  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  let printedDiff: string | undefined;
  if (pass) {
    if (typeof expected === 'string') {
      if (notFound) {
        printedExpected = `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}`;
        printedReceived = `Received: ${received}`;
      } else {
        printedExpected = `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}`;
        const formattedReceived = printReceivedStringContainExpectedSubstring(receivedString, receivedString.indexOf(expected), expected.length);
        printedReceived = `Received string: ${formattedReceived}`;
      }
    } else {
      if (notFound) {
        printedExpected = `Expected pattern: not ${this.utils.printExpected(expected)}`;
        printedReceived = `Received: ${received}`;
      } else {
        printedExpected = `Expected pattern: not ${this.utils.printExpected(expected)}`;
        const formattedReceived = printReceivedStringContainExpectedResult(receivedString, typeof expected.exec === 'function' ? expected.exec(receivedString) : null);
        printedReceived = `Received string: ${formattedReceived}`;
      }
    }
  } else {
    const labelExpected = `Expected ${typeof expected === 'string' ? stringSubstring : 'pattern'}`;
    if (notFound) {
      printedExpected = `${labelExpected}: ${this.utils.printExpected(expected)}`;
      printedReceived = `Received: ${received}`;
    } else {
      printedDiff = this.utils.printDiffOrStringify(expected, receivedString, labelExpected, 'Received string', false);
    }
  }

  const message = () => {
    const resultDetails = printedDiff ? printedDiff : printedExpected + '\n' + printedReceived;
    const hints = matcherHint(this, receiverType === 'Locator' ? receiver as Locator : undefined, matcherName, options.receiverLabel ?? 'locator', undefined, matcherOptions, timedOut ? timeout : undefined, resultDetails, true);
    return hints + callLogText(log);
  };

  return {
    name: matcherName,
    expected,
    message,
    pass,
    actual: received,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}
