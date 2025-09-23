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


import { expectTypes } from '../util';
import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring
} from './expect';
import { formatMatcherMessage } from './matcherHint';
import { EXPECTED_COLOR } from '../common/expectBundle';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Page, Locator } from 'playwright-core';

export async function toMatchText(
  this: ExpectMatcherState,
  matcherName: string,
  receiver: Locator | Page,
  receiverType: 'Locator' | 'Page',
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: string, log?: string[], timedOut?: boolean, errorMessage?: string }>,
  expected: string | RegExp,
  options: { timeout?: number, matchSubstring?: boolean } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  expectTypes(receiver, [receiverType], matcherName);
  const locator = receiverType === 'Locator' ? receiver as Locator : undefined;

  if (
    !(typeof expected === 'string') &&
    !(expected && typeof expected.test === 'function')
  ) {
    const errorMessage = `Error: ${EXPECTED_COLOR('expected')} value must be a string or regular expression\n${this.utils.printWithType('Expected', expected, this.utils.printExpected)}`;
    throw new Error(formatMatcherMessage(this, { locator, matcherName, expectation: 'expected', errorMessage }));
  }

  const timeout = options.timeout ?? this.timeout;

  const { matches: pass, received, log, timedOut, errorMessage } = await query(!!this.isNot, timeout);

  if (pass === !this.isNot) {
    return {
      name: matcherName,
      message: () => '',
      pass,
      expected
    };
  }

  const expectedSuffix = typeof expected === 'string' ? (options.matchSubstring ? ' substring' : '') : ' pattern';
  const receivedSuffix = typeof expected === 'string' ? (options.matchSubstring ? ' string' : '') : ' string';
  const receivedString = received || '';
  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  let printedDiff: string | undefined;
  if (pass) {
    if (typeof expected === 'string') {
      printedExpected = `Expected${expectedSuffix}: not ${this.utils.printExpected(expected)}`;
      if (!errorMessage) {
        const formattedReceived = printReceivedStringContainExpectedSubstring(receivedString, receivedString.indexOf(expected), expected.length);
        printedReceived = `Received${receivedSuffix}: ${formattedReceived}`;
      }
    } else {
      printedExpected = `Expected${expectedSuffix}: not ${this.utils.printExpected(expected)}`;
      if (!errorMessage) {
        const formattedReceived = printReceivedStringContainExpectedResult(receivedString, typeof expected.exec === 'function' ? expected.exec(receivedString) : null);
        printedReceived = `Received${receivedSuffix}: ${formattedReceived}`;
      }
    }
  } else {
    if (errorMessage)
      printedExpected = `Expected${expectedSuffix}: ${this.utils.printExpected(expected)}`;
    else
      printedDiff = this.utils.printDiffOrStringify(expected, receivedString, `Expected${expectedSuffix}`, `Received${receivedSuffix}`, false);
  }

  const message = () => {
    return formatMatcherMessage(this, {
      matcherName,
      expectation: 'expected',
      locator,
      timeout,
      timedOut,
      printedExpected,
      printedReceived,
      printedDiff,
      log,
      errorMessage,
    });
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
