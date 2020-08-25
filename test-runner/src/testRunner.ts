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

import { FixturePool, rerunRegistrations, setParameters } from './fixtures';
import { EventEmitter } from 'events';
import { setCurrentTestFile } from './expect';
import { Test, Suite, Configuration } from './test';
import { spec } from './spec';
import { RunnerConfig } from './runnerConfig';

export type TestRunnerEntry = {
  file: string;
  ordinals: number[];
  configurationString: string;
  configuration: Configuration;
  hash: string;
};

export class TestRunner extends EventEmitter {
  private _currentOrdinal = -1;
  private _failedWithError: any | undefined;
  private _fatalError: any | undefined;
  private _file: any;
  private _ordinals: Set<number>;
  private _remaining: Set<number>;
  private _trialRun: any;
  private _configuredFile: any;
  private _parsedGeneratorConfiguration: any = {};
  private _timeout: number;
  private _fixturePool: FixturePool<RunnerConfig>;

  constructor(fixturePool: FixturePool<RunnerConfig>, entry: TestRunnerEntry, config: RunnerConfig, workerId: number) {
    super();
    this._fixturePool = fixturePool;
    this._file = entry.file;
    this._ordinals = new Set(entry.ordinals);
    this._remaining = new Set(entry.ordinals);
    this._trialRun = config.trialRun;
    this._timeout = config.timeout;
    fixturePool.config = config;
    this._configuredFile = entry.file + `::[${entry.configurationString}]`;
    for (const {name, value} of entry.configuration)
      this._parsedGeneratorConfiguration[name] = value;
    this._parsedGeneratorConfiguration['parallelIndex'] = workerId;
    setCurrentTestFile(this._file);
  }

  stop() {
    //TODO fix stop
    this._trialRun = true;
  }

  async run() {
    setParameters(this._parsedGeneratorConfiguration);

    const suite = new Suite('');
    const revertBabelRequire = spec(suite, this._file, this._timeout);
    require(this._file);
    revertBabelRequire();
    suite._renumber();

    rerunRegistrations(this._file, 'test');
    await suite.run({
      fixturePool: this._fixturePool,
      onResult: (test, status, error) => {
        if (status === 'fail') {
          this.emit('fail', {
            test: this._serializeTest(test),
          });
        } else if (status === 'pass') {
          this.emit('pass', {
            test: this._serializeTest(test),
          });
        } else if (status === 'skip') {
          this.emit('pending', {
            test: this._serializeTest(test),
          });
        }
      },
      onTestStart: test => {
        this.emit('test', { test: this._serializeTest(test) });
      },
      testFilter: test => {
        // if (this._failedWithError)
        //   return false;
        const ordinal = ++this._currentOrdinal;
        if (this._ordinals.size && !this._ordinals.has(ordinal))
          return false;
        this._remaining.delete(ordinal);
        return true;
      },
      timeout: this._timeout,
      trialRun: this._trialRun,
    });
    this._reportDone();
  }

  private _reportDone() {
    this.emit('done', {
      error: this._failedWithError,
      fatalError: this._fatalError,
      remaining: [...this._remaining],
    });
  }

  private _serializeTest(test) {
    return {
      id: `${test._ordinal}@${this._configuredFile}`,
      error: test.error,
      duration: Date.now() - test._startTime,
    };
  }
}