/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { it } from './fixtures';

it('should close page with active dialog', (test, { browserName, platform }) => {
  test.fixme(browserName === 'webkit' && platform === 'darwin', 'WebKit hangs on a Mac');
}, async ({context}) => {
  const page = await context.newPage();
  await page.setContent(`<button onclick="setTimeout(() => alert(1))">alert</button>`);
  page.click('button');
  await page.waitForEvent('dialog');
  await page.close();
});

it('should access page after beforeunload', (test, { browserName }) => {
  test.fixme(browserName === 'firefox', 'Only works on WebKit atm');
  test.fixme(browserName === 'chromium');
}, async ({context}) => {
  const page = await context.newPage();
  await page.evaluate(() => {
    window.addEventListener('beforeunload', event => {
      event.preventDefault();
      event.returnValue = 'Do you want to close page?';
    });
  });
  await page.close({ runBeforeUnload: true });
  const dialog = await page.waitForEvent('dialog');
  await dialog.dismiss();
  await page.evaluate(() => document.title);
});
