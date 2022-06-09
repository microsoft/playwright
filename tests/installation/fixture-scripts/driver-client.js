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

const pw = require.resolve('playwright');
const oop = require.resolve('playwright-core/lib/outofprocess', { paths: [pw] });
const { start } = require(oop);

(async () => {
  const { playwright, stop } = await start();
  console.log(`driver PID=${playwright.driverProcess.pid}`);
  for (const browserType of ['chromium', 'firefox', 'webkit']) {
    try {
      const browser = await playwright[browserType].launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.evaluate(() => navigator.userAgent);
      await browser.close();
      console.log(`${browserType} SUCCESS`);
    } catch (e) {
      console.error(`Should be able to launch ${browserType} from ${process.cwd()}`);
      console.error(e);
      process.exit(1);
    }
  }
  await stop();
  console.log(`driver SUCCESS`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
