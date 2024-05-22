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
import { kNoElementsFoundError, matcherHint } from './matcherHint';
import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Locator } from 'playwright-core';

export async function toBeTruthy(
  this: ExpectMatcherState,
  matcherName: string,
  receiver: Locator,
  receiverType: string,
  expected: string,
  unexpected: string,
  arg: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, log?: string[], received?: any, timedOut?: boolean }>,
  options: { timeout?: number } = {},
): Promise<MatcherResult<any, any>> {
  expectTypes(receiver, [receiverType], matcherName);

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  const timeout = options.timeout ?? this.timeout;
  const { matches, log, timedOut, received } = await query(!!this.isNot, timeout);
  const notFound = received === kNoElementsFoundError ? received : undefined;
  const actual = matches ? expected : unexpected;
  const message = () => {
    const header = matcherHint(this, receiver, matcherName, 'locator', arg, matcherOptions, timedOut ? timeout : undefined);
    const logText = callLogText(log);
    return matches ? `${header}Expected: not ${expected}\nReceived: ${notFound ? kNoElementsFoundError : expected}${logText}` :
      `${header}Expected: ${expected}\nReceived: ${notFound ? kNoElementsFoundError : unexpected}${logText}`;
  };
  return {
    message,
    pass: matches,
    actual,
    name: matcherName,
    expected,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}
