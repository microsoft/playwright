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
import path from 'path';

export default class PreviousTestsOnWorkerReporter implements Reporter {
  private _parallelIndex2TestCase: Map<number, TestCase[]> = new Map();

  onTestEnd(test: TestCase, result: TestResult) {
    const toRelativPath = (file: string) => path.relative(path.join(__dirname, '../..'), file);

    if (!this._parallelIndex2TestCase.has(result.parallelIndex))
      this._parallelIndex2TestCase.set(result.parallelIndex, []);
    this._parallelIndex2TestCase.get(result.parallelIndex)!.push(test);
    if (!test.ok()) {
      console.log(`Test ${test.title}(${toRelativPath(test.location.file)}:${test.location.line})failed on worker ${result.parallelIndex} with error: ${result.error?.message}`);
      console.log(`The following tests were running before on the same worker:`);
      for (const test of this._parallelIndex2TestCase.get(result.parallelIndex)!)
        console.log(`  ${toRelativPath(test.location.file)}:${test.location.line}`);
      console.log(`The following files were running before on the same worker:`);
      const files = new Set<string>(this._parallelIndex2TestCase.get(result.parallelIndex)!.map(test => test.location.file));
      for (const file of files)
        console.log(`  ${toRelativPath(file)}`);
      this._parallelIndex2TestCase.delete(result.parallelIndex);
    }
  }
}
