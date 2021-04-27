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
 import WebSocket from 'ws';
 import fs from 'fs';
import { debugLogger } from '../lib/utils/debugLogger';
const delay = ms => new Promise(f => setTimeout(f, ms));

 it('websocket should return the page content', (test, {browserName}) => {
 }, async ({server, browserType, browserOptions }) => {
   const browser = await browserType.launch(browserOptions);
   const page = await browser.newPage();
   if (server.PREFIX.includes("https"))
    return;
    debugLogger.log('api', server.PREFIX);
   // create echo server
   const wsServerPort = server.PORT + 2;
  
   const wsServer = new WebSocket.Server({port: wsServerPort});
   wsServer.on('connection', ws => {
    ws.on('message', message => {
        ws.send(message);
    })
   });
   wsServer.on('listening', () => {
      debugLogger.log('api', "listening on port " + wsServerPort);
   });

   server.setRoute('/wsTest', (req, res) => {
    fs.readFile(__dirname + "/testWs.html", (err, contents) => {
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(contents);
    });
  });

  // Go to http://localhost:8000/wsTest
  await page.goto(server.PREFIX + '/wsTest');

  // Click input[name="wsServer"]
  await page.click('input[name="wsServer"]');

  // Fill input[name="wsServer"]
  await page.fill('input[name="wsServer"]', `ws://localhost:${wsServerPort}`);

  // Click text=Submit
  await page.click('text=Submit');

  
   let resp = await page.evaluate(() => {
    const texts = document.body.getElementsByTagName("*");
    let textValues = [];
    for (let i = 0; i < texts.length; i++)
      textValues.push(texts[i].textContent);
  
    return textValues;
   });

   debugLogger.log('api', resp);

   // Click text=RESPONSE: WebSocket rocks
  await page.click('text=RESPONSE: WebSocket rocks');
   // response is the response received from the server to the browser 
   wsServer.close();
   // run data check in the page
   await browser.close();
 });
