/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { it, expect } from './fixtures';

import fs from 'fs';


it('should be able to save file', (test, { browserName, headful }) => {
  test.skip(headful || browserName !== 'chromium', 'Printing to pdf is currently only supported in headless chromium.');
}, async ({page, testInfo}) => {
  const outputFile = testInfo.outputPath('output.pdf');
  await page.pdf({path: outputFile});
  expect(fs.readFileSync(outputFile).byteLength).toBeGreaterThan(0);
});

it('should only have pdf in chromium', (test, { browserName }) => {
  test.skip(browserName === 'chromium');
}, async ({page}) => {
  expect(page.pdf).toBe(undefined);
});
