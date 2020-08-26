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

import { RunnerConfig } from './runnerConfig';
import { Suite, Test } from './test';

export interface Reporter {
  onBegin(config: RunnerConfig, suite: Suite): void;
  onTest(test: Test): void;
  onSkippedTest(test: Test): void;
  onTestStdOut(test: Test, chunk: string | Buffer);
  onTestStdErr(test: Test, chunk: string | Buffer);
  onTestPassed(test: Test): void;
  onTestFailed(test: Test): void;
  onEnd(): void;
}
