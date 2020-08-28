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

import { options } from './playwright.fixtures';

import fs from 'fs';
import path from 'path';


// Printing to pdf is currently only supported in headless chromium.
it.skip(!(options.HEADLESS && options.CHROMIUM))('should be able to save file', async ({page, tmpDir}) => {
  const outputFile = path.join(tmpDir, 'output.pdf');
  await page.pdf({path: outputFile});
  expect(fs.readFileSync(outputFile).byteLength).toBeGreaterThan(0);
  fs.unlinkSync(outputFile);
});

it.skip(options.CHROMIUM)('should be able to save file', async ({page}) => {
  expect(page.pdf).toBe(undefined);
});
