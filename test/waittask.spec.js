/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const utils = require('./utils');
const {FFOX, CHROMIUM, WEBKIT} = utils.testOptions(browserType);

describe('Frame.waitForSelector', function() {
  it('wait for selector', async({page, server}) => {
    await page.setContent(`<div >hi!</div>`);
    const waitForSelector = page.waitForSelector('div');
    expect(await page.evaluate(x => x.textContent, await waitForSelector)).toBe("hi!");
  });
  it('wait for selector', async({page, server}) => {
    await page.setContent(`<div hidden="hidden">hi!</div><div >hi!</div>`);
    const waitForSelector = page.waitForSelector('div');
    expect(await page.evaluate(x => x.textContent, await waitForSelector)).toBe("hi!");
  });
});