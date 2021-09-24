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
import { ExpectedTextValue } from '../../protocol/channels';
import { isRegExp, isString } from '../../utils/utils';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { expectType } from '../util';

export async function toMatchText(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  receiver: any,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ pass: boolean, received?: string }>,
  expected: string | RegExp,
  options: { timeout?: number, matchSubstring?: boolean } = {},
) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`${matcherName} must be called during the test`);
  expectType(receiver, receiverType, matcherName);

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
            this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions),
            `${this.utils.EXPECTED_COLOR(
                'expected',
            )} value must be a string or regular expression`,
            this.utils.printWithType('Expected', expected, this.utils.printExpected),
        ),
    );
  }

  let defaultExpectTimeout = testInfo.project.expect?.timeout;
  if (typeof defaultExpectTimeout === 'undefined')
    defaultExpectTimeout = 5000;
  const timeout = options.timeout === 0 ? 0 : options.timeout || defaultExpectTimeout;

  const { pass, received } = await query(this.isNot, timeout);
  const stringSubstring = options.matchSubstring ? 'substring' : 'string';
  const message = pass
    ? () =>
      typeof expected === 'string'
        ? this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}\n` +
        `Received string: ${printReceivedStringContainExpectedSubstring(
            received!,
            received!.indexOf(expected),
            expected.length,
        )}`
        : this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        `Expected pattern: not ${this.utils.printExpected(expected)}\n` +
        `Received string: ${printReceivedStringContainExpectedResult(
            received!,
            typeof expected.exec === 'function'
              ? expected.exec(received!)
              : null,
        )}`
    : () => {
      const labelExpected = `Expected ${typeof expected === 'string' ? stringSubstring : 'pattern'
      }`;
      const labelReceived = 'Received string';

      return (
        this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions) +
        '\n\n' +
        this.utils.printDiffOrStringify(
            expected,
            received,
            labelExpected,
            labelReceived,
            this.expand !== false,
        ));
    };

  return { message, pass };
}

export function normalizeWhiteSpace(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

export function toExpectedTextValues(items: (string | RegExp)[], options: { matchSubstring?: boolean, normalizeWhiteSpace?: boolean } = {}): ExpectedTextValue[] {
  return items.map(i => ({
    string: isString(i) ? i : undefined,
    regexSource: isRegExp(i) ? i.source : undefined,
    regexFlags: isRegExp(i) ? i.flags : undefined,
    matchSubstring: options.matchSubstring,
    normalizeWhiteSpace: options.normalizeWhiteSpace,
  }));
}
