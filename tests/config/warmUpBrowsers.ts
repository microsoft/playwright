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

import * as playwright from '@playwright/test';
import type { FullConfig } from '@playwright/test';

// A freshly installed browser may need minutes to produce its first frame, for example
// headless Chromium on the macOS Intel bots. Without a warm-up, the first tests that click
// in each worker time out. This global setup takes that delay before the tests start.
const kWarmUpTimeout = 5 * 60 * 1000;

async function warmUpBrowsers(config: FullConfig) {
  const warmedUp = new Set<string>();
  for (const project of config.filteredProjects) {
    const { browserName, headless, channel, launchOptions } = project.use;
    if (!browserName || warmedUp.has(browserName))
      continue;
    warmedUp.add(browserName);
    const startTime = Date.now();
    try {
      const browser = await playwright[browserName].launch({ ...launchOptions, headless, channel });
      const page = await browser.newPage();
      await page.goto('data:text/html,<button>Warm up</button>', { timeout: kWarmUpTimeout });
      await page.click('button', { timeout: kWarmUpTimeout });
      await browser.close();
      console.log(`Warmed up ${browserName} in ${Date.now() - startTime}ms`);
    } catch (e) {
      // The tests give a better error for a browser that does not start.
      console.error(`Failed to warm up ${browserName} after ${Date.now() - startTime}ms: ${e}`);
    }
  }
}

export default warmUpBrowsers;
