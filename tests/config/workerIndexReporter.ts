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
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class WorkerIndexReporter implements Reporter {
  private _workerIndex2TestTitles: Map<number, TestCase[]> = new Map();

  constructor() {
    console.log('WorkerIndexReporter loaded!');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!this._workerIndex2TestTitles.has(result.workerIndex))
      this._workerIndex2TestTitles.set(result.workerIndex, []);
    this._workerIndex2TestTitles.get(result.workerIndex)!.push(test);

    if (test.outcome() === 'unexpected') {
      console.log(`\n\n\nWorker ${result.workerIndex} failed while running:`);
      for (const test of this._workerIndex2TestTitles.get(result.workerIndex)!)
        console.log(`  ${test.location.file}:${test.location.line}`);
      console.log('\n\n\n');
    }
  }
}
export default WorkerIndexReporter;