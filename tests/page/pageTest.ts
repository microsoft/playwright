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

import { baseTest } from '../config/baseTest';
import type { Page } from '../../index';
export { expect } from '../config/test-runner';

// Page test does not guarantee an isolated context, just a new page (because Android).
export type PageTestFixtures = {
  browserVersion: string;
  browserMajorVersion: number;
  page: Page;
  isAndroid: boolean;
  isElectron: boolean;
};

export const test = baseTest.declare<PageTestFixtures>();
