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

import type { ReporterDescription } from '../../types/test';
import type { TestError } from '../../types/testReporter';
import type { ReporterV2 } from './reporterV2';

export type ReporterOptions = {
  configDir: string,
  _mode: 'list' | 'test' | 'merge',
  _isTestServer: boolean,
  _commandHash: string,
};

export type ExtractReporterSpecificOptions<T extends ReporterDescription[0]> = Extract<ReporterDescription, Readonly<[T, any]>>[1];

export type ExtractReporterOptions<T extends ReporterDescription[0]> = ExtractReporterSpecificOptions<T> & ReporterOptions;

export interface ErrorCollectingReporter extends ReporterV2 {
  errors(): TestError[];
}
