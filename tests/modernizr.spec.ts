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

import { browserTest as it, expect } from './config/browserTest';
import fs from 'fs';

async function checkFeatures(name: string, context: any, server: any) {
  try {
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/modernizr.html');
    const actual = await page.evaluate('window.report');
    const expected = JSON.parse(fs.readFileSync(require.resolve(`./assets/modernizr/${name}.json`), 'utf-8'));
    expect(actual).toEqual(expected);
  } finally {
    await context.close();
  }
}

it('safari-14-1', async ({ browser, browserName, platform, server }) => {
  /* GTK
   -   "gamepads": true,
   +   "gamepads": false,
   -   "getusermedia": true,
   -   "hairline": true,
   +   "getusermedia": false,
   +   "hairline": false,
   +   "hasEvent": undefined,

       "input": Object {
   -     "list": true,
   +     "list": false,
       },
       "inputtypes": Object {
   -     "color": true,
   -     "date": true,
   +     "color": false,
   +     "date": false,
   -     "datetime-local": true,
   +     "datetime-local": false,
   -     "time": true,
   +     "time": false,
       },
   -   "peerconnection": true,
   +   "peerconnection": false,
   -   "pointerlock": true,
   +   "pointerlock": false,
   -   "speechrecognition": true,
   -   "speechsynthesis": true,
   +   "speechrecognition": false,
   +   "speechsynthesis": false,
   -   "subpixelfont": true,
   +   "subpixelfont": false,
   -   "todataurljpeg": true,
   +   "todataurljpeg": false,
   */

  /* WPE
   -   "datalistelem": true,
   +   "datalistelem": false,
   */

  it.skip(browserName !== 'webkit' ||  platform !== 'darwin');
  const context = await browser.newContext({
    deviceScaleFactor: 2
  });
  await checkFeatures('safari-14-1', context, server);
});

it('mobile-safari-14-1', async ({ playwright, browser, browserName, platform, server }) => {
  it.fixme();

  /* macOS
   -   "capture": true,
   +   "capture": false,
   -   "cssscrollbar": false,
   +   "cssscrollbar": true,
   -   "cssvhunit": false,
   -   "cssvmaxunit": false,
   +   "cssvhunit": true,
   +   "cssvmaxunit": true,
   -   "devicemotion": true,
   -   "deviceorientation": true,
   +   "devicemotion": false,
   +   "deviceorientation": false,
   -   "fullscreen": false,
   +   "fullscreen": true,
       "inputtypes": Object {
   -     "month": true,
   +     "month": false,
   -     "week": true,
   +     "week": false,
       },
   -   "notification": false,
   +   "notification": true,
   -   "overflowscrolling": true,
   +   "overflowscrolling": false,
   -   "pointerlock": false,
   +   "pointerlock": true,
   */

  /* GTK
   -   "datalistelem": true,
   +   "datalistelem": false,
   -   "gamepads": true,
   +   "gamepads": false,
   -   "getusermedia": true,
   -   "hairline": true,
   +   "getusermedia": false,
   +   "hairline": false,
   +   "hasEvent": undefined,

       "input": Object {
   -     "list": true,
   +     "list": false,
       },
       "inputtypes": Object {
   -     "color": true,
   -     "date": true,
   +     "color": false,
   +     "date": false,
   -     "datetime-local": true,
   +     "datetime-local": false,
   -     "time": true,
   +     "time": false,
       },
   -   "peerconnection": true,
   +   "peerconnection": false,
   -   "pointerlock": true,
   +   "pointerlock": false,
   -   "speechrecognition": true,
   -   "speechsynthesis": true,
   +   "speechrecognition": false,
   +   "speechsynthesis": false,
   -   "subpixelfont": true,
   +   "subpixelfont": false,
   -   "todataurljpeg": true,
   +   "todataurljpeg": false,
   */

  /* WPE
   -   "datalistelem": true,
   +   "datalistelem": false,
   */

  it.skip(browserName !== 'webkit' || platform !== 'darwin');
  const iPhone = playwright.devices['iPhone 12'];
  const context = await browser.newContext(iPhone);
  await checkFeatures('mobile-safari-14-1', context, server);
});
