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
import { formatMatcherMessage } from './matcherHint';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Locator } from 'playwright-core';

export async function toBeTruthy(
  this: ExpectMatcherState,
  matcherName: string,
  locator: Locator,
  receiverType: string,
  expected: string,
  arg: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, log?: string[], received?: any, timedOut?: boolean, errorMessage?: string }>,
  options: { timeout?: number } = {},
): Promise<MatcherResult<any, any>> {
  expectTypes(locator, [receiverType], matcherName);

  const timeout = options.timeout ?? this.timeout;

  const { matches: pass, log, timedOut, received, errorMessage } = await query(!!this.isNot, timeout);

  if (pass === !this.isNot) {
    return {
      name: matcherName,
      message: () => '',
      pass,
      expected
    };
  }

  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  if (pass) {
    printedExpected = `Expected: not ${expected}`;
    printedReceived = errorMessage ? '' : `Received: ${expected}`;
  } else {
    printedExpected = `Expected: ${expected}`;
    printedReceived = errorMessage ? '' : `Received: ${received}`;
  }
  const message = () => {
    return formatMatcherMessage(this, {
      matcherName,
      expectation: arg,
      locator,
      timeout,
      timedOut,
      printedExpected,
      printedReceived,
      errorMessage,
      log,
    });
  };

  return {
    message,
    pass,
    actual: received,
    name: matcherName,
    expected,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}
