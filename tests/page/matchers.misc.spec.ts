/**
 * Copyright (c) Microsoft Corporation.
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

import { stripAnsi } from '../config/utils';
import { test as it, expect } from './pageTest';

it('should outlive frame navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  setTimeout(async () => {
    await page.goto(server.PREFIX + '/grid.html').catch(() => {});
  }, 1000);
  await expect(page.locator('.box').first()).toBeEmpty();
});

it('should print no-locator-resolved error when locator matcher did not resolve to any element', async ({ page, server }) => {
  const myLocator = page.locator('.nonexisting');
  const expectWithShortLivingTimeout = expect.configure({ timeout: 10 });
  const locatorMatchers = [
    () => expectWithShortLivingTimeout(myLocator).toBeAttached(),                 // Boolean matcher
    () => expectWithShortLivingTimeout(myLocator).toHaveJSProperty('abc', 'abc'), // Equal matcher
    () => expectWithShortLivingTimeout(myLocator).not.toHaveText('abc'),          // Text matcher - pass / string
    () => expectWithShortLivingTimeout(myLocator).not.toHaveText(/abc/),          // Text matcher - pass / RegExp
    () => expectWithShortLivingTimeout(myLocator).toContainText('abc'),           // Text matcher - fail / string
    () => expectWithShortLivingTimeout(myLocator).toContainText(/abc/),           // Text matcher - fail / RegExp
  ];
  for (const matcher of locatorMatchers) {
    await it.step(matcher.toString(), async () => {
      const error = await matcher().catch(e => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(`waiting for locator('.nonexisting')`);
      expect(stripAnsi(error.message)).toMatch(/Received:  ?"?<element\(s\) not found>/);
    });
  }
});
