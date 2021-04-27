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

import { debugLogger } from '../lib/utils/debugLogger';
import { it, expect } from '../test/fixtures';

 it('should return the page content', async ({browser, httpsServer}) => {
   debugLogger.log('api',"PREFIX : " + httpsServer.PREFIX);
   const context = await browser.newContext({ ignoreHTTPSErrors: true });
   const page = await context.newPage();

   debugLogger.log('api', "got page");

   httpsServer.setRoute("/hello", (req, res) => {
    res.end("hello world");
   });
   await page.goto(httpsServer.PREFIX + '/hello');
   const text = await page.evaluate(() => document.body.getElementsByTagName("*")[0].textContent);
   expect(text).toBe("hello world");
   // run data check in the page
   await browser.close();
 });
