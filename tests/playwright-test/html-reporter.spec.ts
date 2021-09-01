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

import { test, expect } from './playwright-test-fixtures';
import * as path from 'path';

const kHTMLReporterPath = path.join(__dirname, '..', '..', 'lib', 'test', 'reporters', 'html.js');

test('should not throw when attachment is missing', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { preserveOutput: 'failures-only' };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('passes', async ({ page }, testInfo) => {
        const screenshot = testInfo.outputPath('screenshot.png');
        await page.screenshot({ path: screenshot });
        testInfo.attachments.push({ name: 'screenshot', path: screenshot, contentType: 'image/png' });
      });
    `,
  }, { reporter: 'dot,' + kHTMLReporterPath });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
