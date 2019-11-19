/**
 * Copyright 2017 Google Inc. All rights reserved.
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

'use strict';

const playwright = require('playwright');

(async() => {
  const browser = await playwright.launch();
  const page = await browser.newPage();

  // Define a window.onCustomEvent function on the page.
  await page.exposeFunction('onCustomEvent', e => {
    console.log(`${e.type} fired`, e.detail || '');
  });

  /**
   * Attach an event listener to page to capture a custom event on page load/navigation.
   * @param {string} type Event name.
   * @return {!Promise}
   */
  function listenFor(type) {
    return page.evaluateOnNewDocument(type => {
      document.addEventListener(type, e => {
        window.onCustomEvent({type, detail: e.detail});
      });
    }, type);
  }

  await listenFor('app-ready'); // Listen for "app-ready" custom event on page load.

  await page.goto('https://www.chromestatus.com/features', {waitUntil: 'networkidle0'});

  await browser.close();
})();
