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

const requireName = process.argv[2];
const browsers = process.argv.slice(3);

const playwright = require(requireName);

// Requiring internals should work.
const errors = require(requireName + '/lib/errors');
const installer = require(requireName + '/lib/install/installer');

(async () => {
  for (const browserType of browsers) {
    const browser = await playwright[browserType].launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.evaluate(() => navigator.userAgent);
    await browser.close();
  }
  console.log(`require SUCCESS`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
