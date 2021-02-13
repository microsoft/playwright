/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { folio as baseFolio } from './fixtures';
import { Page } from '..';
import { chromium } from '../index';

const fixtures = baseFolio.extend<{
  recorderPageGetter: () => Promise<Page>,
}>();

fixtures.recorderPageGetter.init(async ({context, toImpl}, runTest) => {
  await runTest(async () => {
    while (!toImpl(context).recorderAppForTest)
      await new Promise(f => setTimeout(f, 100));
    const wsEndpoint = toImpl(context).recorderAppForTest.wsEndpoint;
    const browser = await chromium.connectOverCDP({ wsEndpoint });
    const c = browser.contexts()[0];
    return c.pages()[0] || await c.waitForEvent('page');
  });
});

export const folio = fixtures.build();
