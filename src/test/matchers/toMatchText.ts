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

import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring
} from 'expect/build/print';

import {
  EXPECTED_COLOR,
  getLabelPrinter,
  matcherErrorMessage,
  matcherHint, MatcherHintOptions,
  printExpected,
  printReceived,
  printWithType,
} from 'jest-matcher-utils';
import { Locator } from '../../..';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { monotonicTime, pollUntilDeadline } from '../util';

async function toMatchTextImpl(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  exactMatch: boolean,
  options: { timeout?: number, useInnerText?: boolean } = {},
) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);

  const matcherName = exactMatch ? 'toHaveText' : 'toMatchText';
  const matcherOptions: MatcherHintOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && typeof expected.test === 'function')
  ) {
    throw new Error(
        matcherErrorMessage(
            matcherHint(matcherName, undefined, undefined, matcherOptions),
            `${EXPECTED_COLOR(
                'expected',
            )} value must be a string or regular expression`,
            printWithType('Expected', expected, printExpected),
        ),
    );
  }

  let received: string;
  let pass = false;
  const timeout = options.timeout === 0 ? 0 : options.timeout || testInfo.timeout;
  const deadline = timeout ? monotonicTime() + timeout : 0;

  try {
    await pollUntilDeadline(async () => {
      received = options?.useInnerText ? await locator.innerText() : await locator.textContent() || '';
      if (exactMatch)
        pass = expected === received;
      else
        pass = typeof expected === 'string' ? received.includes(expected) : new RegExp(expected).test(received);
      return pass === !matcherOptions.isNot;
    }, deadline, 100);
  } catch (e) {
    pass = false;
  }

  const stringSubstring = exactMatch ? 'string' : 'substring';
  const message = pass
    ? () =>
      typeof expected === 'string'
        ? matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `Expected ${stringSubstring}: not ${printExpected(expected)}\n` +
        `Received string:        ${printReceivedStringContainExpectedSubstring(
            received,
            received.indexOf(expected),
            expected.length,
        )}`
        : matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `Expected pattern: not ${printExpected(expected)}\n` +
        `Received string:      ${printReceivedStringContainExpectedResult(
            received,
            typeof expected.exec === 'function'
              ? expected.exec(received)
              : null,
        )}`
    : () => {
      const labelExpected = `Expected ${typeof expected === 'string' ? stringSubstring : 'pattern'
      }`;
      const labelReceived = 'Received string';
      const printLabel = getLabelPrinter(labelExpected, labelReceived);

      return (
        matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `${printLabel(labelExpected)}${printExpected(expected)}\n` +
        `${printLabel(labelReceived)}${printReceived(received)}`
      );
    };

  return { message, pass };
}

export async function toMatchText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string | RegExp,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchTextImpl.call(this, locator, expected, false, options);
}

export async function toHaveText(
  this: ReturnType<Expect['getState']>,
  locator: Locator,
  expected: string,
  options?: { timeout?: number, useInnerText?: boolean },
) {
  return toMatchTextImpl.call(this, locator, expected, true, options);
}