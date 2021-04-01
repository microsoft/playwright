/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import rimraf from 'rimraf';
import { promisify } from 'util';
import { Dispatcher } from './dispatcher';
import { Reporter } from './types';
import { createMatcher, monotonicTime, raceAgainstDeadline } from './util';
import { Suite } from './test';
import { Loader } from './loader';

const removeFolderAsync = promisify(rimraf);

type RunResult = 'passed' | 'failed' | 'sigint' | 'forbid-only' | 'no-tests';

export class Runner {
  private _reporter: Reporter;
  private _loader: Loader;
  private _rootSuite: Suite;

  constructor(loader: Loader, reporter: Reporter, runListFilter?: string[]) {
    this._reporter = reporter;
    this._loader = loader;

    // This makes sure we don't generate 1000000 tests if only one spec is focused.
    const filtered = new Set<Suite>();
    for (const { fileSuites } of loader.runLists()) {
      for (const fileSuite of fileSuites.values()) {
        if (fileSuite._hasOnly())
          filtered.add(fileSuite);
      }
    }

    this._rootSuite = new Suite('');
    const grepMatcher = createMatcher(loader.config().grep);

    const nonEmptySuites = new Set<Suite>();
    for (let runListIndex = 0; runListIndex < loader.runLists().length; runListIndex++) {
      const runList = loader.runLists()[runListIndex];
      if (runListFilter && !runListFilter.includes(runList.alias))
        continue;
      for (const fileSuite of runList.fileSuites.values()) {
        if (filtered.size && !filtered.has(fileSuite))
          continue;
        const specs = fileSuite._allSpecs().filter(spec => grepMatcher(spec.fullTitle()));
        if (!specs.length)
          continue;
        fileSuite._renumber();
        for (const spec of specs) {
          for (let i = 0; i < loader.config().repeatEach; ++i)
            spec._appendTest(runListIndex, runList.alias, i);
        }
        nonEmptySuites.add(fileSuite);
      }
    }
    for (const fileSuite of nonEmptySuites)
      this._rootSuite._addSuite(fileSuite);

    filterOnly(this._rootSuite);
  }

  list() {
    this._reporter.onBegin(this._loader.config(), this._rootSuite);
    this._reporter.onEnd();
  }

  async run(): Promise<RunResult> {
    await removeFolderAsync(this._loader.config().outputDir).catch(e => {});

    if (this._loader.config().forbidOnly) {
      const hasOnly = this._rootSuite.findSpec(t => t._only) || this._rootSuite.findSuite(s => s._only);
      if (hasOnly)
        return 'forbid-only';
    }

    const total = this._rootSuite.totalTestCount();
    if (!total)
      return 'no-tests';
    const globalDeadline = this._loader.config().globalTimeout ? this._loader.config().globalTimeout + monotonicTime() : 0;
    const { result, timedOut } = await raceAgainstDeadline(this._runTests(this._rootSuite), globalDeadline);
    if (timedOut) {
      this._reporter.onTimeout(this._loader.config().globalTimeout);
      process.exit(1);
    }
    return result;
  }

  private async _runTests(suite: Suite): Promise<RunResult> {
    const dispatcher = new Dispatcher(this._loader, suite, this._reporter);
    let sigint = false;
    let sigintCallback: () => void;
    const sigIntPromise = new Promise<void>(f => sigintCallback = f);
    const sigintHandler = () => {
      process.off('SIGINT', sigintHandler);
      sigint = true;
      sigintCallback();
    };
    process.on('SIGINT', sigintHandler);
    this._reporter.onBegin(this._loader.config(), suite);
    await Promise.race([dispatcher.run(), sigIntPromise]);
    await dispatcher.stop();
    this._reporter.onEnd();
    if (sigint)
      return 'sigint';
    return dispatcher.hasWorkerErrors() || suite.findSpec(spec => !spec.ok()) ? 'failed' : 'passed';
  }
}

function filterOnly(suite: Suite) {
  const onlySuites = suite.suites.filter(child => filterOnly(child) || child._only);
  const onlyTests = suite.specs.filter(spec => spec._only);
  if (onlySuites.length || onlyTests.length) {
    suite.suites = onlySuites;
    suite.specs = onlyTests;
    return true;
  }
  return false;
}
