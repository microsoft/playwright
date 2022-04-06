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
import type { Reporter, TestCase } from '@playwright/test/reporter';

test.use({ locale: 'en-US' });

test.describe('block', () => {
  test.beforeAll(async ({ browser }) => {
  });
  test.afterAll(async ({ browser }) => {
  });
  test.beforeEach(async ({ page }) => {
  });
  test.afterEach(async ({ page }) => {
  });
  test('should work', async ({ page, browserName }, testInfo) => {
    test.skip(browserName === 'chromium');
    await page.click(testInfo.title);
    testInfo.annotations.push({ type: 'foo' });
    await page.fill(testInfo.outputPath('foo', 'bar'), testInfo.outputDir);
  });
});

const test2 = test.extend<{ foo: string, bar: number }>({
  foo: '123',
  bar: async ({ foo }, use) => {
    await use(parseInt(foo, 10));
  },
});

test2('should work 2', async ({ foo, bar }) => {
  bar += parseInt(foo, 10);
  expect(bar).toBe(123 * 2);
});

export class MyReporter implements Reporter {
  onTestBegin(test: TestCase) {
    test.titlePath().slice();
    if (test.results[0].status === test.expectedStatus)
      console.log(`Nice test ${test.title} at ${test.location.file}`);
  }
}
