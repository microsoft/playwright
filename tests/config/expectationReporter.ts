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
import path from 'path';

type TestOutcome = 'unknown' | 'flaky' | 'pass' | 'fail' | 'timeout';

type Expectation = {
  expectation: 'skip' | 'fixme' | 'fail';
  reason?: string;
};

type ReporterOptions = {
  rebase?: boolean;
  expectationsDir?: string;
  expectationsFile?: string;
};

class ExpectationReporter implements Reporter {
  private _suite: Suite;
  private _options: ReporterOptions;
  private _pendingUpdates: Promise<void>[] = [];

  constructor(options: ReporterOptions) {
    this._options = options;
  }

  async preprocess({ suite, testRun }: Parameters<NonNullable<Reporter['preprocess']>>[0]) {
    if (!this._options.expectationsFile && !process.env.PWTEST_USE_BIDI_EXPECTATIONS)
      return;
    if (this._options.rebase)
      return;
    for (const project of suite.suites) {
      const expectations = await parseExpectations(this._expectationsPath(project.title));
      const visit = (entry: Suite | TestCase) => {
        const expectation = expectations.get(expectationKey(entry));
        if (expectation)
          testRun[expectation.expectation](entry, expectation.reason ?? `marked as ${expectation.expectation} in expectations`);
        else if (entry.type !== 'test')
          entry.entries().forEach(visit);
      };
      project.entries().forEach(visit);
    }
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
    const outputFile = this._expectationsPath(project.title);
    const expectations = await parseExpectations(outputFile);
    for (const test of project.allTests()) {
      const outcome = getOutcome(test);
      const key = expectationKey(test);
      if (outcome === 'timeout')
        expectations.set(key, { expectation: 'fixme' });
      else if (expectations.has(key) && test.outcome() !== 'skipped')
        expectations.delete(key); // Remove tests that no longer timeout.
    }
    const keys = Array.from(expectations.keys());
    keys.sort();
    const results = keys.map(key => `${key} [${expectations.get(key)!.expectation}]`);
    console.log('Writing new expectations to', outputFile);
    await fs.promises.writeFile(outputFile, results.join('\n'));
  }

  printsToStdio(): boolean {
    return false;
  }

  private _expectationsPath(projectName: string): string {
    return this._options.expectationsFile ?? path.join(this._options.expectationsDir!, projectName + '.conf');
  }
}

function getOutcome(test: TestCase): TestOutcome {
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

function expectationKey(entry: Suite | TestCase): string {
  return entry.titlePath().slice(2).join(' > ');
}

async function parseExpectations(filePath: string): Promise<Map<string, Expectation>> {
  try {
    await fs.promises.access(filePath);
  } catch (e) {
    return new Map();
  }
  const content = await fs.promises.readFile(filePath);
  const expectations = new Map<string, Expectation>();
  let reason: string | undefined;
  for (const line of content.toString().split('\n')) {
    if (!line.trim())
      continue;
    if (line.startsWith('#')) {
      reason = line.substring(1).trim();
      continue;
    }
    const match = /^(?<titlePath>.+) \[(?<expectation>skip|fixme|fail)\]$/.exec(line);
    if (!match) {
      console.error('Bad expectation line: ' + line);
      continue;
    }
    expectations.set(match.groups!.titlePath, { expectation: match.groups!.expectation as Expectation['expectation'], reason });
  }
  return expectations;
}

export default ExpectationReporter;
