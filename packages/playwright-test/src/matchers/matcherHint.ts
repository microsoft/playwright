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

import { colors } from 'playwright-core/lib/utilsBundle';
import type { Expect } from '../common/types';

export function matcherHint(state: ReturnType<Expect['getState']>, matcherName: string, a: any, b: any, matcherOptions: any, timeout?: number) {
  const message = state.utils.matcherHint(matcherName, a, b, matcherOptions);
  if (timeout)
    return colors.red(`Timed out ${timeout}ms waiting for `) + message;
  return message;
}
