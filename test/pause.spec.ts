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
import { folio } from './fixtures';
const extended = folio.extend();
extended.browserOptions.override(({browserOptions}, runTest) => {
  return runTest({
    ...browserOptions,
    headless: false,
  });
});
const {it, expect } = extended.build();
it('should pause and resume the script', async ({page}) => {
  let resolved = false;
  const resumePromise = (page as any)._pause().then(() => resolved = true);
  await new Promise(x => setTimeout(x, 0));
  expect(resolved).toBe(false);
  await page.click('playwright-resume');
  await resumePromise;
  expect(resolved).toBe(true);
});

it('should pause through a navigation', async ({page, server}) => {
  let resolved = false;
  const resumePromise = (page as any)._pause().then(() => resolved = true);
  await new Promise(x => setTimeout(x, 0));
  expect(resolved).toBe(false);
  await page.goto(server.EMPTY_PAGE);
  await page.click('playwright-resume');
  await resumePromise;
  expect(resolved).toBe(true);
});

it('should pause after a navigation', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);

  let resolved = false;
  const resumePromise = (page as any)._pause().then(() => resolved = true);
  await new Promise(x => setTimeout(x, 0));
  expect(resolved).toBe(false);
  await page.click('playwright-resume');
  await resumePromise;
  expect(resolved).toBe(true);
});
