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

import type { Expect } from '../common/types';
import { expectTypes } from '../util';
import { callLogText } from '../util';
import { matcherHint } from './matcherHint';
import { currentExpectTimeout } from '../common/globals';

// Omit colon and one or more spaces, so can call getLabelPrinter.
const EXPECTED_LABEL = 'Expected';
const RECEIVED_LABEL = 'Received';

// The optional property of matcher context is true if undefined.
const isExpand = (expand?: boolean): boolean => expand !== false;

export async function toEqual<T>(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  receiver: any,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, received?: any, log?: string[], timedOut?: boolean }>,
  expected: T,
  options: { timeout?: number, contains?: boolean } = {},
) {
  expectTypes(receiver, [receiverType], matcherName);

  const matcherOptions = {
    comment: options.contains ? '' : 'deep equality',
    isNot: this.isNot,
    promise: this.promise,
  };

  const timeout = currentExpectTimeout(options);

  const { matches: pass, received, log, timedOut } = await query(this.isNot, timeout);

  const message = pass
    ? () =>
      matcherHint(this, matcherName, undefined, undefined, matcherOptions, timedOut ? timeout : undefined) +
      '\n\n' +
      `Expected: not ${this.utils.printExpected(expected)}\n` +
      (this.utils.stringify(expected) !== this.utils.stringify(received)
        ? `Received:     ${this.utils.printReceived(received)}`
        : '') + callLogText(log)
    : () =>
      matcherHint(this, matcherName, undefined, undefined, matcherOptions, timedOut ? timeout : undefined) +
      '\n\n' +
      this.utils.printDiffOrStringify(
          expected,
          received,
          EXPECTED_LABEL,
          RECEIVED_LABEL,
          isExpand(this.expand),
      ) + callLogText(log);

  // Passing the actual and expected objects so that a custom reporter
  // could access them, for example in order to display a custom visual diff,
  // or create a different error message
  return { actual: received, expected, message, name: matcherName, pass };
}
