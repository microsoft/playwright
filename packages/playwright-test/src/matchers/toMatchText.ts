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

import colors from 'colors/safe';
import type { ExpectedTextValue } from 'playwright-core/lib/protocol/channels';
import { isRegExp, isString } from 'playwright-core/lib/utils/utils';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { expectType } from '../util';
import {
  printReceivedStringContainExpectedResult,
  printReceivedStringContainExpectedSubstring,
} from '../expect';

export async function toMatchText(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  receiver: any,
  receiverType: string,
  query: (
    isNot: boolean,
    timeout: number,
  ) => Promise<{ matches: boolean; received?: string; log?: string[] }>,
  expected: string | RegExp,
  options: { timeout?: number; matchSubstring?: boolean } = {},
) {
  expectType(receiver, receiverType, matcherName);

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (!(typeof expected === 'string') && !(expected && typeof expected.test === 'function')) {
    throw new Error(
      this.utils.matcherErrorMessage(
        this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions),
        `${this.utils.EXPECTED_COLOR('expected')} value must be a string or regular expression`,
        this.utils.printWithType('Expected', expected, this.utils.printExpected),
      ),
    );
  }

  const timeout = currentExpectTimeout(options);

  const { matches: pass, received, log } = await query(this.isNot, timeout);
  const stringSubstring = options.matchSubstring ? 'substring' : 'string';
  const receivedString = received || '';
  const message = pass
    ? () =>
        typeof expected === 'string'
          ? this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions) +
            '\n\n' +
            `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}\n` +
            `Received string: ${printReceivedStringContainExpectedSubstring(
              receivedString,
              receivedString.indexOf(expected),
              expected.length,
            )}` +
            callLogText(log)
          : this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions) +
            '\n\n' +
            `Expected pattern: not ${this.utils.printExpected(expected)}\n` +
            `Received string: ${printReceivedStringContainExpectedResult(
              receivedString,
              typeof expected.exec === 'function' ? expected.exec(receivedString) : null,
            )}` +
            callLogText(log)
    : () => {
        const labelExpected = `Expected ${
          typeof expected === 'string' ? stringSubstring : 'pattern'
        }`;
        const labelReceived = 'Received string';

        return (
          this.utils.matcherHint(matcherName, undefined, undefined, matcherOptions) +
          '\n\n' +
          this.utils.printDiffOrStringify(
            expected,
            receivedString,
            labelExpected,
            labelReceived,
            this.expand !== false,
          ) +
          callLogText(log)
        );
      };

  return { message, pass };
}

export function toExpectedTextValues(
  items: (string | RegExp)[],
  options: { matchSubstring?: boolean; normalizeWhiteSpace?: boolean } = {},
): ExpectedTextValue[] {
  return items.map((i) => ({
    string: isString(i) ? i : undefined,
    regexSource: isRegExp(i) ? i.source : undefined,
    regexFlags: isRegExp(i) ? i.flags : undefined,
    matchSubstring: options.matchSubstring,
    normalizeWhiteSpace: options.normalizeWhiteSpace,
  }));
}

export function callLogText(log: string[] | undefined): string {
  if (!log) return '';
  return `
Call log:
  ${colors.dim('- ' + (log || []).join('\n  - '))}
`;
}

export function currentExpectTimeout(options: { timeout?: number }) {
  const testInfo = currentTestInfo();
  if (options.timeout !== undefined) return options.timeout;
  let defaultExpectTimeout = testInfo?.project.expect?.timeout;
  if (typeof defaultExpectTimeout === 'undefined') defaultExpectTimeout = 5000;
  return defaultExpectTimeout;
}
