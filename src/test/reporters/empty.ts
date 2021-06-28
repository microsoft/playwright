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

import { FullConfig, TestResult, Test, Suite, TestError, Reporter, FullResult } from '../reporter';

class EmptyReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {}
  onTestBegin(test: Test) {}
  onStdOut(chunk: string | Buffer, test?: Test) {}
  onStdErr(chunk: string | Buffer, test?: Test) {}
  onTestEnd(test: Test, result: TestResult) {}
  onError(error: TestError) {}
  async onEnd(result: FullResult) {}
}

export default EmptyReporter;
