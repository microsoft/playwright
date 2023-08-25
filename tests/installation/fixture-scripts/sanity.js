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
const success = process.argv.slice(3);
const playwright = require(requireName);

const packageJSON = require(requireName + '/package.json');
if (!packageJSON || !packageJSON.version) {
  console.error('Should be able to require the package.json and get the version.')
  process.exit(1);
}

(async () => {
  for (const browserType of success) {
    try {
      const browser = await playwright[browserType].launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.evaluate(() => navigator.userAgent);
      await browser.close();
    } catch (e) {
      console.error(`Should be able to launch ${browserType} from ${requireName}`);
      console.error(e);
      process.exit(1);
    }
  }
  const fail = ['chromium', 'webkit', 'firefox'].filter(x => !success.includes(x));
  for (const browserType of fail) {
    try {
      await playwright[browserType].launch();
      console.error(`Should not be able to launch ${browserType} from ${requireName}`);
      process.exit(1);
    } catch (e) {
      // All good.
      console.log(`Expected error while launching ${browserType}: ${e}`);
    }
  }
  console.log(`require SUCCESS`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
