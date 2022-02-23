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

import type { Expect } from '../types';
import { expectType, callLogText, currentExpectTimeout } from '../util';

export async function toBeTruthy(
  this: ReturnType<Expect['getState']>,
  matcherName: string,
  receiver: any,
  receiverType: string,
  query: (isNot: boolean, timeout: number) => Promise<{ matches: boolean, log?: string[] }>,
  options: { timeout?: number } = {},
) {
  expectType(receiver, receiverType, matcherName);

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  const timeout = currentExpectTimeout(options);

  const { matches, log } = await query(this.isNot, timeout);

  const message = () => {
    return this.utils.matcherHint(matcherName, undefined, '', matcherOptions) + callLogText(log);
  };

  return { message, pass: matches };
}
