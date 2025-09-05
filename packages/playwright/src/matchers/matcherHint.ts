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

import { stringifyStackFrames } from 'playwright-core/lib/utils';
import { DIM_COLOR, RECEIVED_COLOR, EXPECTED_COLOR } from '../common/expectBundle';
import { callLogText } from '../util';

import type { ExpectMatcherState } from '../../types/test';
import type { StackFrame } from '@protocol/channels';
import type { Locator } from 'playwright-core';

type MatcherMessageDetails = {
  receiver?: string; // Assuming 'locator' when locator is provided, 'page' otherwise.
  matcherName: string;
  expectation: string;
  locator?: Locator;
  printedExpected?: string;
  printedReceived?: string;
  printedDiff?: string;
  timeout?: number;
  errorMessage?: string;
  log?: string[];
};

export function formatMatcherMessage(state: ExpectMatcherState, details: MatcherMessageDetails) {
  const receiver = details.receiver ?? (details.locator ? 'locator' : 'page');
  let header = DIM_COLOR('expect(') + RECEIVED_COLOR(receiver)
      + DIM_COLOR(')' + (state.promise ? '.' + state.promise : '') + (state.isNot ? '.not' : '') + '.')
      + details.matcherName
      + DIM_COLOR('(') + EXPECTED_COLOR(details.expectation) + DIM_COLOR(')')
      + ' failed\n\n';
  const align = !details.errorMessage && (details.printedExpected?.startsWith('Expected:') || details.printedDiff?.startsWith('Expected:'));
  const timeoutAfterDiff = !!details.printedDiff && details.printedDiff.split('\n').length === 2;
  if (details.locator)
    header += `Locator: ${align ? ' ' : ''}${String(details.locator)}\n`;
  if (details.printedExpected)
    header += details.printedExpected + '\n';
  if (details.printedReceived)
    header += details.printedReceived + '\n';
  if (details.timeout && !timeoutAfterDiff)
    header += `Timeout: ${align ? ' ' : ''}${details.timeout}ms\n`;
  if (details.printedDiff)
    header += details.printedDiff + '\n';
  if (details.timeout && timeoutAfterDiff)
    header += `Timeout: ${align ? ' ' : ''}${details.timeout}ms\n`;
  if (details.errorMessage) {
    header += details.errorMessage;
    if (!details.errorMessage.endsWith('\n'))
      header += '\n';
  }
  //   const message = details.errorMessage.replace(/Error(:\s?)?/, '');
  //   header += `Error: ${message}\n`;
  // }
  return header + callLogText(details.log);
}

export type MatcherResult<E, A> = {
  name: string;
  expected?: E;
  message: () => string;
  pass: boolean;
  actual?: A;
  log?: string[];
  timeout?: number;
  suggestedRebaseline?: string;
};

export type MatcherResultProperty = Omit<MatcherResult<unknown, unknown>, 'message'> & {
  message: string;
};

type JestError = Error & {
  matcherResult: MatcherResultProperty;
};

export class ExpectError extends Error {
  matcherResult: MatcherResultProperty;

  constructor(jestError: JestError, customMessage: string, stackFrames: StackFrame[]) {
    super('');
    // Copy to erase the JestMatcherError constructor name from the console.log(error).
    this.name = jestError.name;
    this.message = jestError.message;
    this.matcherResult = jestError.matcherResult;

    if (customMessage)
      this.message = customMessage + '\n\n' + this.message;
    this.stack = this.name + ': ' + this.message + '\n' + stringifyStackFrames(stackFrames).join('\n');
  }
}

export function isJestError(e: unknown): e is JestError {
  return e instanceof Error && 'matcherResult' in e;
}
