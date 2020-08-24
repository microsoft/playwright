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

import { BaseReporter } from './base';
import { Suite, Test } from '../test';
import * as fs from 'fs';

class JSONReporter extends BaseReporter {
  onEnd() {
    super.onEnd();
    const result = {
      config: this.config,
      suites: this.suite.suites.map(suite => this._serializeSuite(suite)).filter(s => s)
    };
    const report = JSON.stringify(result, undefined, 2);
    if (process.env.PWRUNNER_JSON_REPORT)
      fs.writeFileSync(process.env.PWRUNNER_JSON_REPORT, report);
    else
      console.log(report);
  }

  private _serializeSuite(suite: Suite): any {
    if (!suite.eachTest(test => true))
      return null;
    const suites = suite.suites.map(suite => this._serializeSuite(suite)).filter(s => s);
    return {
      title: suite.title,
      file: suite.file,
      configuration: suite.configuration,
      tests: suite.tests.map(test => this._serializeTest(test)),
      suites: suites.length ? suites : undefined
    };
  }

  private _serializeTest(test: Test): any {
    return {
      title: test.title,
      file: test.file,
      only: test.only,
      pending: test.pending,
      slow: test.slow,
      duration: test.duration,
      timeout: test.timeout,
      error: test.error
    };
  }
}

export default JSONReporter;
