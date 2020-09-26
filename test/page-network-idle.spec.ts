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

import { it, expect } from './fixtures';
import type { Frame, Page } from '..';
import { TestServer } from '../utils/testserver';

it('should navigate to empty page with networkidle', async ({page, server}) => {
  const response = await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
  expect(response.status()).toBe(200);
});

async function networkIdleTest(frame: Frame, server: TestServer, action: () => Promise<any>, isSetContent?: boolean) {
  const finishResponse = response => {
    response.statusCode = 404;
    response.end(`File not found`);
  };
  const waitForRequest = suffix => {
    return Promise.all([
      server.waitForRequest(suffix),
      (frame['_page'] as Page).waitForRequest(server.PREFIX + suffix),
    ]);
  };
  const responses = {};
  // Hold on to a bunch of requests without answering.
  server.setRoute('/fetch-request-a.js', (req, res) => responses['a'] = res);
  const firstFetchResourceRequested = waitForRequest('/fetch-request-a.js');
  server.setRoute('/fetch-request-d.js', (req, res) => responses['d'] = res);
  const secondFetchResourceRequested = waitForRequest('/fetch-request-d.js');

  const waitForLoadPromise = isSetContent ? Promise.resolve() : frame.waitForNavigation({ waitUntil: 'load' });

  // Navigate to a page which loads immediately and then does a bunch of
  // requests via javascript's fetch method.
  const actionPromise = action();

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
}

it('should wait for networkidle to succeed navigation', async ({page, server}) => {
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
  });
});

it('should wait for networkidle to succeed navigation with request from previous navigation', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/foo.js', () => {});
  await page.setContent(`<script>fetch('foo.js');</script>`);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
  });
});

it('should wait for networkidle in waitForNavigation', async ({page, server}) => {
  await networkIdleTest(page.mainFrame(), server, () => {
    const promise = page.waitForNavigation({ waitUntil: 'networkidle' });
    page.goto(server.PREFIX + '/networkidle.html');
    return promise;
  });
});

it('should wait for networkidle in setContent', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
  }, true);
});

it('should wait for networkidle in setContent with request from previous navigation', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/foo.js', () => {});
  await page.setContent(`<script>fetch('foo.js');</script>`);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
  }, true);
});

it('should wait for networkidle when navigating iframe', async ({page, server}) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.mainFrame().childFrames()[0];
  await networkIdleTest(frame, server, () => frame.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' }));
});

it('should wait for networkidle in setContent from the child frame', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.setContent(`<iframe src='networkidle.html'></iframe>`, { waitUntil: 'networkidle' });
  }, true);
});

it('should wait for networkidle from the child frame', async ({page, server}) => {
  await networkIdleTest(page.mainFrame(), server, () => {
    return page.goto(server.PREFIX + '/networkidle-frame.html', { waitUntil: 'networkidle' });
  });
});
