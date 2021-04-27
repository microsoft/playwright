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

import { it, expect } from '../test/fixtures';
import fs from 'fs';
import { debugLogger } from '../lib/utils/debugLogger';
const delay = ms => new Promise(f => setTimeout(f, ms));


 it('http long poll server should return the page content', (test, {browserName}) => {
 }, async ({server, browserType, browserOptions }) => {
   const browser = await browserType.launch(browserOptions);
   const page = await browser.newPage();
   debugLogger.log('api', server.PREFIX);
   // create echo server
   const randomText = ["something", "new", "all"]
   var randomNumber = 0;

   server.setRoute('/httpLongPoll', (req, res) => {
    fs.readFile(__dirname + "/httpLongPoll.html", (err, contents) => {
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(contents);
    });
  });

  server.setRoute('/longpoll', async (req, res) => {
    await delay(1000);
    // waits 5 secs and sends one of the random text
    // mimicing long poll server
    // basically the server is holding the connection and sends the reponse on an event 
    res.writeHead(200);
    res.end(randomText[randomNumber]);
    randomNumber++;
    randomNumber = randomNumber % randomText.length;
  });

    // Go to http://localhost:8000/httpLongPoll
    await page.goto(`${server.PREFIX}/httpLongPoll`);

    // Click input[name="long poll server"]
    await page.click('input[name="long poll server"]');

    // Click input[name="long poll server"]
    await page.click('input[name="long poll server"]');

    // Fill input[name="long poll server"]
    await page.fill('input[name="long poll server"]', `${server.PREFIX}/longpoll`);

    // Click text=Submit
    await page.click('text=Submit', {timeout: 30000});

    // Click text=all
    await page.click('text=all', {timeout: 30000});

    // Click text=something
    await page.click('text=something', {timeout: 30000});

    // Click text=new
    await page.click('text=new', {timeout: 30000});

    const text1 = await page.evaluate(() => document.body.getElementsByTagName("*")[9].textContent);
    expect(text1).toBe("something");

    const text2 = await page.evaluate(() => document.body.getElementsByTagName("*")[10].textContent);
    expect(text2).toBe("new");

    const text3 = await page.evaluate(() => document.body.getElementsByTagName("*")[11].textContent);
    expect(text3).toBe("all");

    await browser.close();
 });
