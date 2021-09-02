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

import {
  matcherHint,
  MatcherHintOptions
} from 'jest-matcher-utils';
import { currentTestInfo } from '../globals';
import type { Expect } from '../types';
import { expectType, pollUntilDeadline } from '../util';

export async function toBeTruthy<T>(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  receiver: any,
  receiverType: string,
  query: (timeout: number) => Promise<T>,
  options: { timeout?: number } = {},
) {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`${matcherName} must be called during the test`);
  expectType(receiver, receiverType, matcherName);

  const matcherOptions: MatcherHintOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  let received: T;
  let pass = false;

  await pollUntilDeadline(testInfo, async remainingTime => {
    received = await query(remainingTime);
    pass = !!received;
    return pass === !matcherOptions.isNot;
  }, options.timeout, testInfo._testFinished);

  const message = () => {
    return matcherHint(matcherName, undefined, '', matcherOptions);
  };

  return { message, pass };
}
