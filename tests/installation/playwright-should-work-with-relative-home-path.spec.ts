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
import { test } from './npmTest';
import os from 'os';

test('playwright should work with relative home path', async ({ exec }) => {
  test.skip(os.platform().startsWith('win'));

  const env = { PLAYWRIGHT_BROWSERS_PATH: '0', HOME: '.' };
  await exec('npm i playwright @playwright/browser-chromium @playwright/browser-webkit', { env });
  // Firefox does not work with relative HOME.
  await exec('node sanity.js playwright chromium webkit', { env });
});
