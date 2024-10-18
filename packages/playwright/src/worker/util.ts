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

import type { TestError } from '../../types/testReporter';
import type { TestInfoError } from '../../types/test';
import type { MatcherResult } from '../matchers/matcherHint';
import { serializeError } from '../util';

export function serializeWorkerError(error: Error | any): TestInfoError & Pick<TestError, 'shortMessage'|'log'|'expected'|'actual'|'locator'> {
  return {
    ...serializeError(error),
    ...serializeExpectDetails(error),
  };
}

function serializeExpectDetails(e: Error): Pick<TestError, 'shortMessage'|'log'|'expected'|'actual'|'locator'> {
  const matcherResult = (e as any).matcherResult as MatcherResult<unknown, unknown>;
  if (!matcherResult)
    return {};
  return {
    shortMessage: matcherResult.header,
    log: matcherResult.log,
    expected: matcherResult.printedExpected,
    actual: matcherResult.printedReceived,
    locator: matcherResult.locator,
  };
}

