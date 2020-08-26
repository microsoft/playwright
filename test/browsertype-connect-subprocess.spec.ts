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

import { options } from './playwright.fixtures';
import './remoteServer.fixture';
import utils from './utils';

it.skip(options.WIRE).slow()('should connect to server from another process', async({ browserType, remoteServer }) => {
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  expect(await page.evaluate('2 + 3')).toBe(5);
  await browser.close();
});

it.skip(options.WIRE).fail(true).slow()('should respect selectors in another process', async({ playwright, browserType, remoteServer }) => {
  const mycss = () => ({
    create(root, target) {},
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await utils.registerEngine(playwright, 'mycss', mycss);

  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await page.setContent(`<div>hello</div>`);
  expect(await page.innerHTML('css=div')).toBe('hello');
  expect(await page.innerHTML('mycss=div')).toBe('hello');
  await browser.close();
});
