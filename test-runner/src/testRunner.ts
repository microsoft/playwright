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

import { FixturePool, rerunRegistrations, setParameters, TestInfo } from './fixtures';
import { EventEmitter } from 'events';
import { setCurrentTestFile } from './expect';
import { Test, Suite, Configuration, serializeError, TestResult } from './test';
import { spec } from './spec';
import { RunnerConfig } from './runnerConfig';
import * as util from 'util';

export const fixturePool = new FixturePool();

export type TestRunnerEntry = {
  file: string;
  ordinals: number[];
  configurationString: string;
  configuration: Configuration;
  hash: string;
};

function chunkToParams(chunk: Buffer | string):  { text?: string, buffer?: string } {
  if (chunk instanceof Buffer)
    return { buffer: chunk.toString('base64') };
  if (typeof chunk !== 'string')
    return { text: util.inspect(chunk) };
  return { text: chunk };
}

export class TestRunner extends EventEmitter {
  private _failedTestId: string | undefined;
  private _fatalError: any | undefined;
  private _file: any;
  private _ordinals: Set<number>;
  private _remaining: Set<number>;
  private _trialRun: any;
  private _configuredFile: any;
  private _parsedGeneratorConfiguration: any = {};
  private _config: RunnerConfig;
  private _timeout: number;
  private _testId: string | null;
  private _stdOutBuffer: (string | Buffer)[] = [];
  private _stdErrBuffer: (string | Buffer)[] = [];
  private _testResult: TestResult | null = null;

  constructor(entry: TestRunnerEntry, config: RunnerConfig, workerId: number) {
    super();
    this._file = entry.file;
    this._ordinals = new Set(entry.ordinals);
    this._remaining = new Set(entry.ordinals);
    this._trialRun = config.trialRun;
    this._timeout = config.timeout;
    this._config = config;
    this._configuredFile = entry.file + `::[${entry.configurationString}]`;
    for (const {name, value} of entry.configuration)
      this._parsedGeneratorConfiguration[name] = value;
    this._parsedGeneratorConfiguration['parallelIndex'] = workerId;
    setCurrentTestFile(this._file);
  }

  stop() {
    this._trialRun = true;
  }

  fatalError(error: Error | any) {
    this._fatalError = serializeError(error);
    if (this._testResult) {
      this._testResult.error = this._fatalError;
      this.emit('testEnd', {
        id: this._testId,
        result: this._testResult
      });
    }
    this._reportDone();
  }

  stdout(chunk: string | Buffer) {
    this._stdOutBuffer.push(chunk);
    if (!this._testId)
      return;
    for (const c of this._stdOutBuffer)
      this.emit('testStdOut', { id: this._testId, ...chunkToParams(c) });
    this._stdOutBuffer = [];
  }

  stderr(chunk: string | Buffer) {
    this._stdErrBuffer.push(chunk);
    if (!this._testId)
      return;
    for (const c of this._stdErrBuffer)
      this.emit('testStdErr', { id: this._testId, ...chunkToParams(c) });
    this._stdErrBuffer = [];
  }

  async run() {
    setParameters(this._parsedGeneratorConfiguration);

    const suite = new Suite('');
    const revertBabelRequire = spec(suite, this._file, this._timeout);
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
      this._fatalError = serializeError(e);
      this._reportDone();
    }
    for (const entry of suite._entries) {
      if (entry instanceof Suite)
        await this._runSuite(entry);
      else
        await this._runTest(entry);

    }
    try {
      await this._runHooks(suite, 'afterAll', 'after');
    } catch (e) {
      this._fatalError = serializeError(e);
      this._reportDone();
    }
  }

  private async _runTest(test: Test) {
    if (this._failedTestId)
      return false;
    if (this._ordinals.size && !this._ordinals.has(test._ordinal))
      return;
    this._remaining.delete(test._ordinal);

    const id = `${test._ordinal}@${this._configuredFile}`;
    this._testId = id;
    this.emit('testBegin', { id });

    const result: TestResult = {
      duration: 0,
      status: 'none',
      stdout: [],
      stderr: [],
      data: {}
    };
    this._testResult = result;

    if (test._skipped || test.suite._isSkipped()) {
      result.status = 'skipped';
      this.emit('testEnd', { id, result });
      return;
    }

    const startTime = Date.now();
    try {
      const testInfo = { config: this._config, test, result };
      await this._runHooks(test.suite, 'beforeEach', 'before', testInfo);
      if (!this._trialRun) {
        const timeout = test.slow ? this._timeout * 3 : this._timeout;
        await fixturePool.runTestWithFixtures(test.fn, timeout, testInfo);
      }
      await this._runHooks(test.suite, 'afterEach', 'after', testInfo);
      result.duration = Date.now() - startTime;
      this.emit('testEnd', { id, result });
    } catch (error) {
      result.error = serializeError(error);
      result.status = 'failed';
      result.duration = Date.now() - startTime;
      this._failedTestId = this._testId;
      this.emit('testEnd', { id, result });
    }
    this._testResult = null;
    this._testId = null;
  }

  private async _runHooks(suite: Suite, type: string, dir: 'before' | 'after', testInfo?: TestInfo) {
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
      await fixturePool.resolveParametersAndRun(hook, this._config, testInfo);
  }

  private _reportDone() {
    this.emit('done', {
      failedTestId: this._failedTestId,
      fatalError: this._fatalError,
      remaining: [...this._remaining],
    });
  }
}
