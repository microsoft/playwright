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

import { test as it, expect } from './pageTest';
import type { Frame } from 'playwright-core';
import type { TestServer } from '../config/testserver';

it('should navigate to empty page with networkidle', async ({ page, server }) => {
  const response = await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
  expect(response.status()).toBe(200);
});

async function networkIdleTest(frame: Frame, server: TestServer, action: () => Promise<any>, isSetContent?: boolean) {
  const waitForRequest = (suffix: string) => {
    return Promise.all([
      server.waitForRequest(suffix),
      frame.page().waitForRequest(server.PREFIX + suffix),
    ]);
  };

  let responseA, responseB;
  // Hold on to a bunch of requests without answering.
  server.setRoute('/fetch-request-a.js', (req, res) => responseA = res);
  const firstFetchResourceRequested = waitForRequest('/fetch-request-a.js');
  server.setRoute('/fetch-request-b.js', (req, res) => responseB = res);
  const secondFetchResourceRequested = waitForRequest('/fetch-request-b.js');

  const waitForLoadPromise = isSetContent ? Promise.resolve() : frame.waitForNavigation({ waitUntil: 'load' });

  // Navigate to a page which loads immediately and then does a bunch of
  // requests via javascript's fetch method.
  const actionPromise = action();

  // Track when the action gets completed.
  let actionFinished = false;
  void actionPromise.then(() => actionFinished = true);

  // Wait for the frame's 'load' event.
  await waitForLoadPromise;
  expect(actionFinished).toBe(false);

  // Wait for the initial resource to be requested.
  await firstFetchResourceRequested;
  expect(actionFinished).toBe(false);

  // Trigger the second request.
  await frame.page().evaluate(() => window['fetchSecond']());
  // Finish the first request.
  responseA.statusCode = 404;
  responseA.end(`File not found`);

  // Wait for the second round to be requested.
  await secondFetchResourceRequested;
  expect(actionFinished).toBe(false);

  // Finishing the second response should trigger networkidle.
  let timerTriggered = false;
  const timer = setTimeout(() => timerTriggered = true, 500);
  responseB.statusCode = 404;
  responseB.end(`File not found`);

  const response = await actionPromise;
  clearTimeout(timer);
  expect(timerTriggered).toBe(true);
  if (!isSetContent)
    expect(response.ok()).toBe(true);
}

it('should wait for networkidle to succeed navigation', async ({ page, server }) => {
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
  });
});

it('should wait for networkidle to succeed navigation with request from previous navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/foo.js', () => {});
  await page.setContent(`<script>fetch('foo.js');</script>`);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
  });
});

it('should wait for networkidle in waitForNavigation', async ({ page, server }) => {
  await networkIdleTest(page.mainFrame(), server, () => {
    const promise = page.waitForNavigation({ waitUntil: 'networkidle' });
    void page.goto(server.PREFIX + '/networkidle.html');
    return promise;
  });
});

it('should wait for networkidle in setContent', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
  }, true);
});

it('should wait for networkidle in setContent with request from previous navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/foo.js', () => {});
  await page.setContent(`<script>fetch('foo.js');</script>`);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
  }, true);
});

it('should wait for networkidle when navigating iframe', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.mainFrame().childFrames()[0];
  await networkIdleTest(frame, server, () => frame.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' }));
});

it('should wait for networkidle in setContent from the child frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.setContent(`<iframe src='networkidle.html'></iframe>`, { waitUntil: 'networkidle' });
  }, true);
});

it('should wait for networkidle from the child frame', async ({ page, server }) => {
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.goto(server.PREFIX + '/networkidle-frame.html', { waitUntil: 'networkidle' });
  });
});

it('should wait for networkidle from the popup', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <button id=box1 onclick="window.open('./popup/popup.html')">Button1</button>
    <button id=box2 onclick="window.open('./popup/popup.html')">Button2</button>
    <button id=box3 onclick="window.open('./popup/popup.html')">Button3</button>
    <button id=box4 onclick="window.open('./popup/popup.html')">Button4</button>
    <button id=box5 onclick="window.open('./popup/popup.html')">Button5</button>
  `);
  for (let i = 1; i < 6; ++i) {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('#box' + i)
    ]);
    await popup.waitForLoadState('networkidle');
  }
});

it('should wait for networkidle when iframe attaches and detaches', async ({ page, server }) => {
  server.setRoute('/empty.html', () => {});
  let done = false;
  const promise = page.setContent(`
    <body>
      <script>
        const iframe = document.createElement('iframe');
        iframe.src = ${JSON.stringify(server.EMPTY_PAGE)};
        document.body.appendChild(iframe);
      </script>
    </body>
  `, { waitUntil: 'networkidle' }).then(() => done = true);
  await page.waitForTimeout(600);
  expect(done).toBe(false);
  await page.evaluate(() => {
    document.querySelector('iframe').remove();
  });
  await promise;
  expect(done).toBe(true);
});

it('should work after repeated navigations in the same page', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18283' });

  let requestCount = 0;
  await page.route('**/empty.html', route => {
    void route.fulfill({
      contentType: 'text/html',
      body: `
        <script>
          fetch('http://localhost:8000/sample').then(res => console.log(res.json()))
        </script>`
    });
  });

  await page.route('**/sample', route => {
    requestCount++;
    void route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        content: 'sample'
      })
    });
  });

  await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
  expect(requestCount).toBe(1);
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
  expect(requestCount).toBe(2);
});
