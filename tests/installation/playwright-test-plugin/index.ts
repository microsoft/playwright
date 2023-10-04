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

import { test as baseTest, expect as expectBase } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = baseTest.extend<{ plugin: string }>({
  plugin: async ({}, use) => {
    await use('hello from plugin');
  },
});

export const expect = expectBase.extend({
  async toContainText(page: Page, expected: string) {
    const locator = page.getByText(expected);

    let pass: boolean;
    let matcherResult: any;
    try {
      await expectBase(locator).toBeVisible();
      pass = true;
    } catch (e: any) {
      matcherResult = e.matcherResult;
      pass = false;
    }

    return {
      name: 'toContainText',
      expected,
      message: () => matcherResult.message,
      pass,
      actual: matcherResult?.actual,
      log: matcherResult?.log,
    };
  }
});
