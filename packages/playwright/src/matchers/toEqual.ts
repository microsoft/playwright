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

import { isRegExp } from 'playwright-core/lib/utils';

import { expectTypes } from '../util';
import { formatMatcherMessage } from './matcherHint';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Locator } from 'playwright-core';

// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';

export async function toEqual<T>(
  this: ExpectMatcherState,
  matcherName: string,
  locator: Locator,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean, errorMessage?: string }>,
  expected: T,
  options: { timeout?: number, contains?: boolean } = {},
): Promise<MatcherResult<any, any>> {
  expectTypes(locator, [receiverType], matcherName);

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

  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  let printedDiff: string | undefined;
  if (pass) {
    printedExpected = `Expected: not ${this.utils.printExpected(expected)}`;
    printedReceived = errorMessage ? '' : `Received: ${this.utils.printReceived(received)}`;
  } else if (errorMessage) {
    printedExpected = `Expected: ${this.utils.printExpected(expected)}`;
  } else if (Array.isArray(expected) && Array.isArray(received)) {
    const normalizedExpected = expected.map((exp, index) => {
      const rec = received[index];
      if (isRegExp(exp))
        return exp.test(rec) ? rec : exp;

      return exp;
    });
    printedDiff = this.utils.printDiffOrStringify(
        normalizedExpected,
        received,
        EXPECTED_LABEL,
        RECEIVED_LABEL,
        false,
    );
  } else {
    printedDiff = this.utils.printDiffOrStringify(
        expected,
        received,
        EXPECTED_LABEL,
        RECEIVED_LABEL,
        false,
    );
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
      errorMessage,
      log,
    });
  };

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
