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

import { it, expect } from './playwright.fixtures';

it('should navigate to empty page with networkidle', async ({page, server}) => {
  const response = await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
  expect(response.status()).toBe(200);
});

function networkIdleTest(method: 'goto' | 'gotoIframe' | 'waitForNavigation' | 'setContent' | 'setContentIframe', childFrame: boolean, staleRequest: boolean) {
  const title = `should wait for networkidle in ${childFrame ? 'child' : 'main'} frame during ${method}${staleRequest ? 'with stale request' : ''}`;

  it(title, async ({page, server}) => {
    let frame = page.mainFrame();
    if (childFrame) {
      await page.goto(server.PREFIX + '/frames/one-frame.html');
      frame = page.mainFrame().childFrames()[0];
    }
    await frame.goto(server.EMPTY_PAGE);

    if (staleRequest) {
      server.setRoute('/foo.js', () => {});
      await frame.setContent(`<script>fetch('foo.js');</script>`);
    }

    const finishResponse = response => {
      response.statusCode = 404;
      response.end(`File not found`);
    };
    const waitForRequest = suffix => {
      return Promise.all([
        server.waitForRequest(suffix),
        page.waitForRequest(server.PREFIX + suffix),
      ]);
    };
    const responses = {};
    // Hold on to a bunch of requests without answering.
    server.setRoute('/fetch-request-a.js', (req, res) => responses['a'] = res);
    const firstFetchResourceRequested = waitForRequest('/fetch-request-a.js');
    server.setRoute('/fetch-request-d.js', (req, res) => responses['d'] = res);
    const secondFetchResourceRequested = waitForRequest('/fetch-request-d.js');

    const isSetContent = method === 'setContent' || method === 'setContentIframe';
    const waitForLoadPromise = isSetContent ? Promise.resolve() : frame.waitForNavigation({ waitUntil: 'load' });

    // Navigate to a page which loads immediately and then does a bunch of
    // requests via javascript's fetch method.
    let actionPromise: Promise<any>;
    switch (method) {
      case 'goto':
        actionPromise = frame.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
        break;
      case 'gotoIframe':
        actionPromise = frame.goto(server.PREFIX + '/networkidle-frame.html', { waitUntil: 'networkidle' });
        break;
      case 'setContent':
        actionPromise = frame.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
        break;
      case 'setContentIframe':
        actionPromise = frame.setContent(`<iframe src='networkidle.html'></iframe>`, { waitUntil: 'networkidle' });
        break;
      case 'waitForNavigation':
        actionPromise = frame.waitForNavigation({ waitUntil: 'networkidle' });
        frame.goto(server.PREFIX + '/networkidle.html');
        break;
    }

    // Track when the action gets completed.
    let actionFinished = false;
    actionPromise.then(() => actionFinished = true);

    // Wait for the frame's 'load' event.
    await waitForLoadPromise;
    expect(actionFinished).toBe(false);

    // Wait for the initial resource to be requested.
    await firstFetchResourceRequested;
    expect(actionFinished).toBe(false);

    expect(responses['a']).toBeTruthy();
    // Finishing response should trigger the second round.
    finishResponse(responses['a']);

    // Wait for the second round to be requested.
    await secondFetchResourceRequested;
    expect(actionFinished).toBe(false);
    // Finishing the last response should trigger networkidle.
    let timerTriggered = false;
    const timer = setTimeout(() => timerTriggered = true, 500);
    finishResponse(responses['d']);

    const response = await actionPromise;
    clearTimeout(timer);
    expect(timerTriggered).toBe(true);
    if (!isSetContent)
      expect(response.ok()).toBe(true);
  });
}

for (const method of ['goto', 'gotoIframe', 'waitForNavigation', 'setContent', 'setContentIframe'] as const) {
  for (const childFrame of [true, false]) {
    for (const staleRequest of [true, false]) {
      networkIdleTest(method, childFrame, staleRequest);
    }
  }
}
