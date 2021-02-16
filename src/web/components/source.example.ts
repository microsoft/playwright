/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

export function exampleText() {
  return `const { chromium, devices } = require('.');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    // ...devices['iPhone 11']
  });

  // Open new page
  const page = await context.newPage();

  // Go to https://github.com/microsoft
  await page.goto('https://github.com/microsoft');
  await page._pause();

  // Click input[aria-label="Find a repository…"]
  await page.click('input[aria-label="Find a repository…"]');

  // Fill input[aria-label="Find a repository…"]
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://github.com/microsoft?q=playwright&type=&language=' }*/),
    page.fill('input[aria-label="Find a repository…"]', 'playwright')
  ]);

  // Click //a[normalize-space(.)='playwright']
  await page.click('//a[normalize-space(.)=\'playwright\']');
  // assert.equal(page.url(), 'https://github.com/microsoft/playwright');

  // Click text="Issues"
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://github.com/microsoft/playwright/issues' }*/),
    page.click('text="Issues"')
  ]);

  // Click text="triaging"
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://github.com/microsoft/playwright/issues?q=is:issue+is:open+label:triaging' }*/),
    page.click('text="triaging"')
  ]);

  // Click text=/.*\[BUG\]\[Electron\] page\.waitForSe.*/
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://github.com/microsoft/playwright/issues/4961' }*/),
    page.click('text=/.*\\\[BUG\\\]\\\[Electron\\\] page\.waitForSe.*/')
  ]);
  await page._pause();

  // Click div[id="partial-users-participants"] img[alt="@pavelfeldman"]
  await page.click('div[id="partial-users-participants"] img[alt="@pavelfeldman"]');
  // assert.equal(page.url(), 'https://github.com/pavelfeldman');
  await page._pause();

  // Click text=/.*Repositories.*/
  await Promise.all([
    page.waitForNavigation(/*{ url: 'https://github.com/pavelfeldman?tab=repositories' }*/),
    page.click('text=/.*Repositories.*/')
  ]);
  await page._pause();

  // Click text=/.*playwright.*/
  await page.click('text=/.*playwright.*/');
  // assert.equal(page.url(), 'https://github.com/pavelfeldman/playwright');
  await page._pause();

  // ---------------------
  await context.close();
  await browser.close();
})();`;
}
