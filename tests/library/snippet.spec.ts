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

import { test, expect } from '@playwright/test';

// This test is for manual/visual verification of the HTML reporter's snippet feature.
// To use:
// 1. Set reporter: [['html', { snippets: false }]] in your playwright.config.ts.
// 2. Run this test
// 3. Open the HTML report and confirm that the code snippet is NOT present for the failure.
// 4. Change snippets: true and confirm the snippet IS present.

test('should fail and allow visual check of HTML report snippet', async () => {
  // This will fail and would normally show a snippet if enabled
  expect(1).toBe(2);
});
