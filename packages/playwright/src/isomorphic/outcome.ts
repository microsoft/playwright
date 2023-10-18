/**
 * Copyright (c) Microsoft Corporation.
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

import type { TestStatus } from '../../types/testReporter';

export function calculateTestOutcome(expectedStatus: TestStatus, results: TestStatus[]) {
  const executedToCompletion = results.filter(result => !['ignored', 'interrupted'].includes(result));
  if (executedToCompletion.every(result => result === 'skipped'))
    return 'skipped';
  const expected = executedToCompletion.filter(result => result === expectedStatus);
  if (!expected.length) // all failed
    return 'unexpected';
  if (expected.length === executedToCompletion.length) // all passed
    return 'expected';
  return 'flaky'; // mixed bag
}
