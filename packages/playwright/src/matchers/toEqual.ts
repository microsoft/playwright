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
import { matcherHint } from './matcherHint';
import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Locator } from 'playwright-core';

// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';

export async function toEqual<T>(
  this: ExpectMatcherState,
  matcherName: string,
  receiver: Locator,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }>,
  expected: T,
  options: { timeout?: number, contains?: boolean } = {},
): Promise<MatcherResult<any, any>> {
  expectTypes(receiver, [receiverType], matcherName);

  const matcherOptions = {
    comment: options.contains ? '' : 'deep equality',
    isNot: this.isNot,
    promise: this.promise,
  };

  const timeout = options.timeout ?? this.timeout;

  const { matches: pass, received, log, timedOut } = await query(!!this.isNot, timeout);

  const message = pass
    ? () =>
      matcherHint(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined) +
      `Expected: not ${this.utils.printExpected(expected)}\n` +
      `Received: ${this.utils.printReceived(received)}` + callLogText(log)
    : () =>
      matcherHint(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined) +
      this.utils.printDiffOrStringify(
          expected,
          received,
          EXPECTED_LABEL,
          RECEIVED_LABEL,
          false,
      ) + callLogText(log);

  // Passing the actual and expected objects so that a custom reporter
  // could access them, for example in order to display a custom visual diff,
  // or create a different error message
  return {
    actual: received,
    expected, message,
    name: matcherName,
    pass,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}
