/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import fs from 'fs';
import { playwrightTest as test, expect } from '../config/browserTest';

test('browserType.executablePath should work', async ({ browserType, channel, mode }) => {
  test.skip(!!channel, 'We skip browser download when testing a channel');
  test.skip(mode.startsWith('service'));
  test.skip(!!(browserType as any)._playwright._defaultLaunchOptions.executablePath, 'Skip with custom executable path');

  const executablePath = browserType.executablePath();
  expect(fs.existsSync(executablePath)).toBe(true);
});

test('browserType.name should work', async ({ browserType, browserName }) => {
  expect(browserType.name()).toBe(browserName);
});

test('should throw when trying to connect with not-chromium', async ({ browserType, browserName }) => {
  test.skip(browserName === 'chromium');

  const error = await browserType.connectOverCDP({ endpointURL: 'ws://foo' }).catch(e => e);
  expect(error.message).toBe('Connecting over CDP is only supported in Chromium.');
});
