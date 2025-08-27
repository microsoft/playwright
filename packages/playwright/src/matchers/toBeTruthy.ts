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

import { callLogText, expectTypes } from '../util';
import { kNoElementsFoundError, matcherHint } from './matcherHint';
import { runBrowserBackendOnError } from '../mcp/browser/backend';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherState } from '../../types/test';
import type { Locator } from 'playwright-core';

export async function toBeTruthy(
  this: ExpectMatcherState,
  matcherName: string,
  receiver: Locator,
  receiverType: string,
  expected: string,
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

  const { matches: pass, log, timedOut, received } = await query(!!this.isNot, timeout).catch(async error => {
    // FIXME: query should not throw, but it does for strict mode violations for example.
    await runBrowserBackendOnError(receiver.page(), () => error.message);
    throw error;
  });

  if (pass === !this.isNot) {
    return {
      name: matcherName,
      message: () => '',
      pass,
      expected
    };
  }

  const notFound = received === kNoElementsFoundError ? received : undefined;
  let printedReceived: string | undefined;
  let printedExpected: string | undefined;
  if (pass) {
    printedExpected = `Expected: not ${expected}`;
    printedReceived = `Received: ${notFound ? kNoElementsFoundError : expected}`;
  } else {
    printedExpected = `Expected: ${expected}`;
    printedReceived = `Received: ${notFound ? kNoElementsFoundError : received}`;
  }
  const message = () => {
    const header = matcherHint(this, receiver, matcherName, 'locator', arg, matcherOptions, timedOut ? timeout : undefined, `${printedExpected}\n${printedReceived}`);
    const logText = callLogText(log);
    return `${header}${logText}`;
  };

  await runBrowserBackendOnError(receiver.page(), message);

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
