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

import path from 'path';
import { FixturePool, registerWorkerFixture, rerunRegistrations, setParameters } from './fixtures';
import { EventEmitter } from 'events';
import { setCurrentTestFile } from './expect';
import { Test, Suite } from './test';
import { fixturesUI } from './fixturesUI';

export const fixturePool = new FixturePool();

export type TestRunnerEntry = {
  file: string;
  ordinals: number[];
  configuredFile: string;
  configurationObject: any;
};

export class TestRunner extends EventEmitter {
  private _currentOrdinal = -1;
  private _failedWithError: Error | undefined;
  private _fatalError: Error | undefined;
  private _file: any;
  private _ordinals: Set<number>;
  private _remaining: Set<number>;
  private _trialRun: any;
  private _configuredFile: any;
  private _configurationObject: any;
  private _parsedGeneratorConfiguration: any = {};
  private _outDir: string;
  private _timeout: number;
  private _testDir: string;

  constructor(entry: TestRunnerEntry, options, workerId) {
    super();
    this._file = entry.file;
    this._ordinals = new Set(entry.ordinals);
    this._remaining = new Set(entry.ordinals);
    this._trialRun = options.trialRun;
    this._timeout = options.timeout;
    this._testDir = options.testDir;
    this._outDir = options.outputDir;
    this._configuredFile = entry.configuredFile;
    this._configurationObject = entry.configurationObject;
    for (const {name, value} of this._configurationObject) {
      this._parsedGeneratorConfiguration[name] = value;
      // @ts-ignore
      registerWorkerFixture(name, async ({}, test) => await test(value));
    }
    this._parsedGeneratorConfiguration['parallelIndex'] = workerId;
    setCurrentTestFile(path.relative(options.testDir, this._file));
  }

  stop() {
    this._trialRun = true;
  }

  async run() {
    setParameters(this._parsedGeneratorConfiguration);

    const suite = new Suite('');
    const revertBabelRequire = fixturesUI(suite, this._file, this._timeout);
    require(this._file);
    revertBabelRequire();
    suite._renumber();

    rerunRegistrations(this._file, 'test');
    await this._runSuite(suite);
    this._reportDone();
  }

  private async _runSuite(suite: Suite) {
    try {
      await this._runHooks(suite, 'beforeAll', 'before');
    } catch (e) {
      this._fatalError = e;
      this._reportDone();
    }
    for (const entry of suite._entries) {
      if (entry instanceof Suite) {
        await this._runSuite(entry);
      } else {
        await this._runTest(entry);
      }
    }
    try {
      await this._runHooks(suite, 'afterAll', 'after');
    } catch (e) {
      this._fatalError = e;
      this._reportDone();
    }
  }

  private async _runTest(test: Test) {
    if (this._failedWithError)
      return false;
    const ordinal = ++this._currentOrdinal;
    if (this._ordinals.size && !this._ordinals.has(ordinal))
      return;
    this._remaining.delete(ordinal);
    if (test.pending) {
      this.emit('pending', { test: this._serializeTest(test) });
      return;
    }

    this.emit('test', { test: this._serializeTest(test) });
    try {
      await this._runHooks(test.suite, 'beforeEach', 'before');
      test._startTime = Date.now();
      if (!this._trialRun)
        await this._testWrapper(test)();
      this.emit('pass', { test: this._serializeTest(test) });
      await this._runHooks(test.suite, 'afterEach', 'after');
    } catch (error) {
      this._failedWithError = error;
      this.emit('fail', {
        test: this._serializeTest(test),
        error: serializeError(error),
      });
    }
  }

  private async _runHooks(suite: Suite, type: string, dir: 'before' | 'after') {
    if (!suite._hasTestsToRun())
      return;
    const all = [];
    for (let s = suite; s; s = s.parent) {
      const funcs = s._hooks.filter(e => e.type === type).map(e => e.fn);
      all.push(...funcs.reverse());
    }
    if (dir === 'before')
      all.reverse();
    for (const hook of all)
      await fixturePool.resolveParametersAndRun(hook, 0);
  }

  private _reportDone() {
    this.emit('done', {
      error: this._failedWithError,
      fatalError: this._fatalError,
      remaining: [...this._remaining],
    });
  }

  private _testWrapper(test: Test) {
    const timeout = test.slow ? this._timeout * 3 : this._timeout;
    return fixturePool.wrapTestCallback(test.fn, timeout, test, {
      outputDir: this._outDir,
      testDir: this._testDir,
    });
  }

  private _serializeTest(test) {
    return {
      id: `${test._ordinal}@${this._configuredFile}`,
      duration: Date.now() - test._startTime,
    };
  }
}

function trimCycles(obj) {
  const cache = new Set();
  return JSON.parse(
    JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value))
          return '' + value;
        cache.add(value);
      }
      return value;
    })
  );
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    }
  }
  return trimCycles(error);
}
