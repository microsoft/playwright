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

import { isRegExp } from '@isomorphic/rtti';

import { expectTypes, formatMatcherMessage } from './matcherHint';

import type { MatcherResult } from './matcherHint';
import type { Locator } from 'playwright-core';
import type { ExpectResult } from 'playwright-core/lib/client/frame';
import type { ExpectMatcherStateInternal } from './matchers';

// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';

export async function toEqual<T>(
  this: ExpectMatcherStateInternal,
  matcherName: string,
  locator: Locator,
  receiverType: 'Locator',
  query: (isNot: boolean, timeout: number) => Promise<ExpectResult>,
  expected: T,
  options: { timeout?: number, contains?: boolean } = {},
): Promise<MatcherResult<any, any>> {
  expectTypes(locator, [receiverType], matcherName);

  const timeout = options.timeout ?? this.timeout;

  const { matches: pass, received, log, timedOut, errorMessage } = await query(!!this.isNot, timeout);
  const receivedValue = received?.value;

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
    printedReceived = errorMessage ? '' : `Received: ${this.utils.printReceived(receivedValue)}`;
  } else if (errorMessage) {
    printedExpected = `Expected: ${this.utils.printExpected(expected)}`;
  } else if (Array.isArray(expected) && Array.isArray(receivedValue)) {
    const normalizedExpected = expected.map((exp, index) => {
      const rec = receivedValue[index];
      if (isRegExp(exp))
        return exp.test(rec) ? rec : exp;

      return exp;
    });
    printedDiff = this.utils.printDiffOrStringify(
        normalizedExpected,
        receivedValue,
        EXPECTED_LABEL,
        RECEIVED_LABEL,
        false,
    );
  } else {
    printedDiff = this.utils.printDiffOrStringify(
        expected,
        receivedValue,
        EXPECTED_LABEL,
        RECEIVED_LABEL,
        false,
    );
  }
  const message = () => {
    return formatMatcherMessage(this.utils, {
      isNot: this.isNot,
      promise: this.promise,
      matcherName,
      expectation: 'expected',
      locator: locator.toString(),
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
    actual: receivedValue,
    expected, message,
    name: matcherName,
    pass,
    log,
    timeout: timedOut ? timeout : undefined,
    ariaSnapshot: received?.ariaSnapshot,
  };
}
