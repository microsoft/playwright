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

import type {
  FullConfig, FullResult, Reporter, Suite, TestCase
} from '@playwright/test/reporter';
import fs from 'fs';
import { parseBidiExpectations as parseExpectations, projectExpectationPath } from './expectationUtil';
import type { TestExpectation } from './expectationUtil';

type ReporterOptions = {
  rebase?: boolean;
};

class ExpectationReporter implements Reporter {
  private _suite: Suite;
  private _options: ReporterOptions;
  private _pendingUpdates: Promise<void>[] = [];

  constructor(options: ReporterOptions) {
    this._options = options;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this._suite = suite;
  }

  onEnd(result: FullResult) {
    if (!this._options.rebase)
      return;
    for (const project of this._suite.suites)
      this._pendingUpdates.push(this._updateProjectExpectations(project));
  }

  async onExit() {
    await Promise.all(this._pendingUpdates);
  }

  private async _updateProjectExpectations(project: Suite) {
    const outputFile = projectExpectationPath(project.title);
    const expectations = await parseExpectations(project.title);
    for (const test of project.allTests()) {
      const outcome = getOutcome(test);
      // Strip root and project names.
      const key = test.titlePath().slice(2).join(' › ');
      if (outcome === 'timeout')
        expectations.set(key, outcome);
      else if (expectations.has(key) && test.outcome() !== 'skipped')
        expectations.delete(key); // Remove tests that no longer timeout.
    }
    const keys = Array.from(expectations.keys());
    keys.sort();
    const results = keys.map(key => `${key} [${expectations.get(key)}]`);
    console.log('Writing new expectations to', outputFile);
    await fs.promises.writeFile(outputFile, results.join('\n'));
  }

  printsToStdio(): boolean {
    return false;
  }
}

function getOutcome(test: TestCase): TestExpectation {
  if (test.results.length === 0)
    return 'unknown';
  if (test.results.every(r => r.status === 'timedOut'))
    return 'timeout';
  if (test.outcome() === 'expected')
    return 'pass';
  if (test.outcome() === 'unexpected')
    return 'fail';
  if (test.outcome() === 'flaky')
    return 'flaky';
  return 'unknown';
}

export default ExpectationReporter;
