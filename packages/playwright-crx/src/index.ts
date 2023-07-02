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

import './shims/global';
import { setUnderTest } from 'playwright-core/lib/utils';

import { createInProcessPlaywright } from 'playwright-core/lib/inProcessFactory';
export { test, expect } from '@playwright/test/lib/index';
export { _runTest } from './runTest';

const playwright = createInProcessPlaywright();

export const _setUnderTest = setUnderTest;
export const { _crx } = playwright;
export default playwright;
