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


import type { ExpectedTextValue } from '@protocol/channels';
import { isRegExp, isString } from 'playwright-core/lib/utils';
import type { Expect } from '../common/types';
import { expectTypes, callLogText } from '../util';
import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring
} from './expect';
import { matcherHint } from './matcherHint';
import { currentExpectTimeout } from '../common/globals';

export async function toMatchText(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  receiver: any,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: string, log?: string[], timedOut?: boolean }>,
  expected: string | RegExp,
  options: { timeout?: number, matchSubstring?: boolean } = {},
) {
  expectTypes(receiver, [receiverType], matcherName);

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (
    !(typeof expected === 'string') &&
    !(expected && typeof expected.test === 'function')
  ) {
    throw new Error(
        this.utils.matcherErrorMessage(
            matcherHint(this, matcherName, undefined, undefined, matcherOptions),
            `${this.utils.EXPECTED_COLOR(
                'expected',
            )} value must be a string or regular expression`,
            this.utils.printWithType('Expected', expected, this.utils.printExpected),
        ),
    );
  }

  const timeout = currentExpectTimeout(options);

  const { matches: pass, received, log, timedOut } = await query(this.isNot, timeout);
  const stringSubstring = options.matchSubstring ? 'substring' : 'string';
  const receivedString = received || '';
  const message = pass
    ? () =>
      typeof expected === 'string'
        ? matcherHint(this, matcherName, undefined, undefined, matcherOptions, timedOut ? timeout : undefined) +
        '\n\n' +
        `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}\n` +
        `Received string: ${printReceivedStringContainExpectedSubstring(
            receivedString,
            receivedString.indexOf(expected),
            expected.length,
        )}` + callLogText(log)
        : matcherHint(this, matcherName, undefined, undefined, matcherOptions, timedOut ? timeout : undefined) +
        '\n\n' +
        `Expected pattern: not ${this.utils.printExpected(expected)}\n` +
        `Received string: ${printReceivedStringContainExpectedResult(
            receivedString,
            typeof expected.exec === 'function'
              ? expected.exec(receivedString)
              : null,
        )}` + callLogText(log)
    : () => {
      const labelExpected = `Expected ${typeof expected === 'string' ? stringSubstring : 'pattern'
      }`;
      const labelReceived = 'Received string';

      return (
        matcherHint(this, matcherName, undefined, undefined, matcherOptions, timedOut ? timeout : undefined) +
        '\n\n' +
        this.utils.printDiffOrStringify(
            expected,
            receivedString,
            labelExpected,
            labelReceived,
            this.expand !== false,
        )) + callLogText(log);
    };

  return { message, pass };
}

export function toExpectedTextValues(items: (string | RegExp)[], options: { matchSubstring?: boolean, normalizeWhiteSpace?: boolean, ignoreCase?: boolean } = {}): ExpectedTextValue[] {
  return items.map(i => ({
    string: isString(i) ? i : undefined,
    regexSource: isRegExp(i) ? i.source : undefined,
    regexFlags: isRegExp(i) ? i.flags : undefined,
    matchSubstring: options.matchSubstring,
    ignoreCase: options.ignoreCase,
    normalizeWhiteSpace: options.normalizeWhiteSpace,
  }));
}
