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

import type { FullConfig, Suite } from '../../types/testReporter';
import type { ReporterV2 } from '../reporters/reporterV2';

export interface TestRunnerPlugin {
  name: string;
  setup?(config: FullConfig, configDir: string, reporter: ReporterV2): Promise<void>;
  populateDependencies?(): Promise<void>;
  startDevServer?(): Promise<() => Promise<void>>;
  clearCache?(): Promise<void>;
  begin?(suite: Suite): Promise<void>;
  end?(): Promise<void>;
  teardown?(): Promise<void>;
}

export type TestRunnerPluginRegistration = {
  factory: TestRunnerPlugin | (() => TestRunnerPlugin | Promise<TestRunnerPlugin>);
  instance?: TestRunnerPlugin;
  devServerCleanup?: any;
};

export { webServer } from './webServerPlugin';
export { gitCommitInfo } from './gitCommitInfoPlugin';
