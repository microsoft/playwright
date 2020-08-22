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
import { NoMocha, Runner, Test } from './test';

export const fixturePool = new FixturePool();

export type TestRunnerEntry = {
  file: string;
  ordinals: number[];
  configuredFile: string;
  configurationObject: any;
};

export class TestRunner extends EventEmitter {
  private _currentOrdinal = -1;
  private _failedWithError = false;
  private _file: any;
  private _ordinals: Set<number>;
  private _remaining: Set<number>;
  private _trialRun: any;
  private _passes = 0;
  private _failures = 0;
  private _pending = 0;
  private _configuredFile: any;
  private _configurationObject: any;
  private _parsedGeneratorConfiguration: any = {};
  private _relativeTestFile: string;
  private _runner: Runner;
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
    this._relativeTestFile = path.relative(options.testDir, this._file);
  }

  async stop() {
    this._trialRun = true;
    return new Promise(f => this._runner.once('done', f));
  }

  async run() {
    let callback;
    const result = new Promise(f => callback = f);
    setParameters(this._parsedGeneratorConfiguration);

    const noMocha = new NoMocha(this._file, {
      timeout: 0,
      testWrapper: (test, fn) => this._testWrapper(test, fn),
      hookWrapper: (hook, fn) => this._hookWrapper(hook, fn),
    });
    rerunRegistrations(this._file, 'test');
    this._runner = noMocha.run(callback);

    this._runner.on('test', test => {
      setCurrentTestFile(this._relativeTestFile);
      if (this._failedWithError)
        return;
      const ordinal = ++this._currentOrdinal;
      if (this._ordinals.size && !this._ordinals.has(ordinal))
        return;
      this._remaining.delete(ordinal);
      this.emit('test', { test: this._serializeTest(test, ordinal) });
    });

    this._runner.on('pending', test => {
      if (this._failedWithError)
        return;
      const ordinal = ++this._currentOrdinal;
      if (this._ordinals.size && !this._ordinals.has(ordinal))
        return;
      this._remaining.delete(ordinal);
      ++this._pending;
      this.emit('pending', { test: this._serializeTest(test, ordinal) });
    });

    this._runner.on('pass', test => {
      if (this._failedWithError)
        return;

      const ordinal = this._currentOrdinal;
      if (this._ordinals.size && !this._ordinals.has(ordinal))
        return;
      ++this._passes;
      this.emit('pass', { test: this._serializeTest(test, ordinal) });
    });

    this._runner.on('fail', (test, error) => {
      if (this._failedWithError)
        return;
      ++this._failures;
      this._failedWithError = error;
      this.emit('fail', {
        test: this._serializeTest(test, this._currentOrdinal),
        error: serializeError(error),
      });
    });

    this._runner.once('done', async () => {
      this.emit('done', {
        stats: this._serializeStats(),
        error: this._failedWithError,
        remaining: [...this._remaining],
        total: this._passes + this._failures + this._pending
      });
    });
    await result;
  }

  _shouldRunTest(hook = false) {
    if (this._trialRun || this._failedWithError)
      return false;
    if (hook) {
      // Hook starts before we bump the test ordinal.
      if (!this._ordinals.has(this._currentOrdinal + 1))
        return false;
    } else {
      if (!this._ordinals.has(this._currentOrdinal))
        return false;
    }
    return true;
  }

  _testWrapper(test: Test, fn: Function) {
    const timeout = test.slow ? this._timeout * 3 : this._timeout;
    const wrapped = fixturePool.wrapTestCallback(fn, timeout, test, {
      outputDir: this._outDir,
      testDir: this._testDir,
    });
    return wrapped ? (done, ...args) => {
      if (!this._shouldRunTest()) {
        done();
        return;
      }
      wrapped(...args).then(done).catch(done);
    } : undefined;
  }

  _hookWrapper(hook, fn) {
    if (!this._shouldRunTest(true))
      return;
    return hook(async () => {
      return await fixturePool.resolveParametersAndRun(fn, 0);
    });
  }

  _serializeTest(test, ordinal) {
    return {
      id: `${ordinal}@${this._configuredFile}`,
      duration: test.duration,
    };
  }
  
  _serializeStats() {
    return {
      passes: this._passes,
      failures: this._failures,
      pending: this._pending,
      duration: this._runner.duration(),
    }
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
