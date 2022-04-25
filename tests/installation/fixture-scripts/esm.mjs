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

export default async function testESM({ chromium, firefox, webkit, selectors, devices, errors, request, playwright }, browsers) {
  if (playwright.chromium !== chromium)
    process.exit(1);
  if (playwright.firefox !== firefox)
    process.exit(1);
  if (playwright.webkit !== webkit)
    process.exit(1);
  if (playwright.errors !== errors)
    process.exit(1);
  if (playwright.request !== request)
    process.exit(1);

  try {
    for (const browserType of browsers) {
      const browser = await browserType.launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.evaluate(() => navigator.userAgent);
      await browser.close();
    }
    console.log(`esm SUCCESS`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
