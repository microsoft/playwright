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
import { it, expect } from './fixtures';

it('browserType.executablePath should work', test => {
  test.skip(Boolean(process.env.CRPATH || process.env.FFPATH || process.env.WKPATH));
}, async ({browserType}) => {
  const executablePath = browserType.executablePath();
  expect(fs.existsSync(executablePath)).toBe(true);
  expect(fs.realpathSync(executablePath)).toBe(executablePath);
});

it('browserType.name should work', async ({browserType, isChromium, isFirefox, isWebKit}) => {
  if (isWebKit)
    expect(browserType.name()).toBe('webkit');
  else if (isFirefox)
    expect(browserType.name()).toBe('firefox');
  else if (isChromium)
    expect(browserType.name()).toBe('chromium');
  else
    throw new Error('Unknown browser');
});
