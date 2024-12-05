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

import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';

it('should be able to save file', async ({ contextFactory, browserName }, testInfo) => {
  it.skip(browserName !== 'chromium', 'Printing to pdf is currently only supported in chromium.');
  const context = await contextFactory();
  const page = await context.newPage();
  const outputFile = testInfo.outputPath('output.pdf');
  await page.pdf({ path: outputFile });
  expect(fs.readFileSync(outputFile).byteLength).toBeGreaterThan(0);
});

it('should be able to generate outline', async ({ contextFactory, server, browserName }, testInfo) => {
  it.skip(browserName !== 'chromium', 'Printing to pdf is currently only supported in chromium.');
  const context = await contextFactory({
    baseURL: server.PREFIX,
  });
  const page = await context.newPage();
  await page.goto('/headings.html');
  const outputFileNoOutline = testInfo.outputPath('outputNoOutline.pdf');
  const outputFileOutline = testInfo.outputPath('outputOutline.pdf');
  await page.pdf({ path: outputFileNoOutline });
  await page.pdf({ path: outputFileOutline, tagged: true, outline: true });
  expect(fs.readFileSync(outputFileOutline).byteLength).toBeGreaterThan(fs.readFileSync(outputFileNoOutline).byteLength);
});
