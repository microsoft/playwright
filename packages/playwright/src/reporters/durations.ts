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
import fs from 'fs';

import { Reporter, TestCase, TestResult } from '../../types/testReporter';

export default class DurationsReporter implements Reporter {
  private _durations = new Map<string, number[]>();
  onTestEnd(test: TestCase, result: TestResult): void {
    const testId = test.id.slice(0, 41); // merge-reporter adds salt for correctness, we don't want it
    if (!this._durations.has(testId))
      this._durations.set(testId, []);
    this._durations.get(testId)!.push(result.duration);
  }
  onEnd() {
    const result: Record<string, number> = {};
    for (const [testId, durations] of this._durations) {
      let total = 0;
      for (const duration of durations)
        total += duration;
      result[testId] = Math.ceil(total / durations.length);
    }
    fs.writeFileSync(
        'durations.json',
        JSON.stringify(result, null, 2)
    );
  }
}
