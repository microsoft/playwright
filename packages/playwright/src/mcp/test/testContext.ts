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

import { TestRunner, TestRunnerEvent } from '../../runner/testRunner';

import type { ConfigLocation } from '../../common/config';

export class TestContext {
  private _testRunner: TestRunner | undefined;
  readonly configLocation: ConfigLocation;
  readonly options?: { muteConsole?: boolean };

  constructor(configLocation: ConfigLocation, options?: { muteConsole?: boolean }) {
    this.configLocation = configLocation;
    this.options = options;
  }

  async createTestRunner(): Promise<TestRunner> {
    if (this._testRunner)
      await this._testRunner.stopTests();
    const testRunner = new TestRunner(this.configLocation, {});
    await testRunner.initialize({});
    this._testRunner = testRunner;
    testRunner.on(TestRunnerEvent.TestFilesChanged, testFiles => {
      this._testRunner?.emit(TestRunnerEvent.TestFilesChanged, testFiles);
    });
    this._testRunner = testRunner;
    return testRunner;
  }

  async close() {
  }
}
