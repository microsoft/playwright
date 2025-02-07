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
import { colors } from 'playwright-core/lib/utilsBundle';

import type { ExpectMatcherState } from '../../types/test';
import type { StackFrame } from '@protocol/channels';
import type { Locator } from 'playwright-core';

export const kNoElementsFoundError = '<element(s) not found>';

export function matcherHint(state: ExpectMatcherState, locator: Locator | undefined, matcherName: string, expression: any, actual: any, matcherOptions: any, timeout?: number) {
  let header = state.utils.matcherHint(matcherName, expression, actual, matcherOptions).replace(/ \/\/ deep equality/, '') + '\n\n';
  if (timeout)
    header = colors.red(`Timed out ${timeout}ms waiting for `) + header;
  if (locator)
    header += `Locator: ${String(locator)}\n`;
  return header;
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
