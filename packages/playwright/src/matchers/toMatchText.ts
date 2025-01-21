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
import type { ExpectMatcherState } from '../../types/test';
import type { MatcherResult } from './matcherHint';
import type { Locator } from 'playwright-core';
import { textMatcherMessage, toMatchExpectedStringOrPredicateVerification } from './error';

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
  toMatchExpectedStringOrPredicateVerification(this, matcherName, receiver, receiver, expected);

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
