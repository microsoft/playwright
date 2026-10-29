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

import { test as testNs, transform } from '../common';

import type { Location, Suite as ReporterSuite, TestCase as ReporterTestCase, TestRun as ReporterTestRun } from '../../types/testReporter';

type ReporterTestRunTarget = ReporterSuite | ReporterTestCase;

export class ReporterTestRunImpl implements ReporterTestRun {
  private _active = true;
  private _skipSharding = false;

  constructor(private _rootSuite: testNs.Suite, private _readonlyProjectSuites: Set<testNs.Suite>) {}

  close() {
    this._active = false;
  }

  shouldSkipSharding() {
    return this._skipSharding;
  }

  mode(suite: ReporterSuite): 'serial' | 'parallel' | 'default' {
    if (!this._active)
      throw new Error(`TestRun.mode() can only be called from Reporter.preprocess().`);
    for (let current: testNs.Suite | undefined = suite as testNs.Suite; current; current = current.parent) {
      if (current._parallelMode !== 'none')
        return current._parallelMode;
    }
    return 'default';
  }

  skipSharding() {
    if (!this._active)
      throw new Error(`TestRun.skipSharding() can only be called from Reporter.preprocess().`);
    if (this._skipSharding)
      throw new Error(`Multiple reporters called 'skipSharding'. Only one reporter may handle sharding.`);
    this._skipSharding = true;
  }

  skip = transform.wrapFunctionWithLocation((location: Location, target: ReporterTestRunTarget, reason?: string) => this._modifier('skip', location, target, reason));
  fixme = transform.wrapFunctionWithLocation((location: Location, target: ReporterTestRunTarget, reason?: string) => this._modifier('fixme', location, target, reason));
  fail = transform.wrapFunctionWithLocation((location: Location, target: ReporterTestRunTarget, reason?: string) => this._modifier('fail', location, target, reason));

  exclude(target: ReporterTestRunTarget) {
    if (!this._active)
      throw new Error(`TestRun.exclude() can only be called from Reporter.preprocess().`);
    const internalTarget = target as testNs.Suite | testNs.TestCase;
    this._checkTarget('exclude', internalTarget);
    internalTarget.parent!._detach(internalTarget);
  }

  private _modifier(type: 'skip' | 'fixme' | 'fail', location: Location, _target: ReporterTestRunTarget, reason: string | undefined) {
    if (!this._active)
      throw new Error(`TestRun.${type}() can only be called from Reporter.preprocess().`);
    const target = _target as testNs.Suite | testNs.TestCase;
    this._checkTarget(type, target);
    const annotation = { type, description: reason, location };
    if (target instanceof testNs.Suite) {
      for (const test of target.allTests())
        test._applyPlanAnnotation(annotation);
    } else {
      target._applyPlanAnnotation(annotation);
    }
  }

  private _checkTarget(method: string, target: testNs.Suite | testNs.TestCase) {
    if (target === this._rootSuite)
      throw new Error(`TestRun.${method}() cannot be called on the root suite.`);
    let suite: testNs.Suite | undefined = target instanceof testNs.Suite ? target : target.parent;
    while (suite) {
      if (this._readonlyProjectSuites.has(suite)) {
        const targetType = target instanceof testNs.TestCase ? ' test' : '';
        throw new Error(`TestRun.${method}() cannot be called on a setup or teardown project${targetType}; these always run in full.`);
      }
      suite = suite.parent;
    }
  }
}
