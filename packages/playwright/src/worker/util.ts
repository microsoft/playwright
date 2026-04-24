/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { serializeError } from '../util';

import type { TestInfoError } from '../../types/test';
import type { MatcherResultProperty } from '../matchers/matcherHint';

export function testInfoError(error: Error | any): TestInfoError {
  const result = serializeError(error);
  const matcherResult = (error instanceof Error ? (error as any).matcherResult : undefined) as MatcherResultProperty | undefined;
  if (matcherResult) {
    const serialized: NonNullable<TestInfoError['matcherResult']> = {
      name: matcherResult.name,
      pass: matcherResult.pass,
    };
    if (matcherResult.expected !== undefined)
      serialized.expected = matcherResult.expected;
    if (matcherResult.actual !== undefined)
      serialized.actual = matcherResult.actual;
    if (matcherResult.log !== undefined)
      serialized.log = matcherResult.log;
    if (matcherResult.timeout !== undefined)
      serialized.timeout = matcherResult.timeout;
    if (matcherResult.ariaSnapshot !== undefined)
      serialized.ariaSnapshot = matcherResult.ariaSnapshot;
    result.matcherResult = serialized;
  }
  return result;
}
