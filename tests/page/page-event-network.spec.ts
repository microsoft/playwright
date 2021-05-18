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

it('Page.Events.Request', async ({page, server}) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
  expect(requests[0].url()).toBe(server.EMPTY_PAGE);
  expect(requests[0].resourceType()).toBe('document');
  expect(requests[0].method()).toBe('GET');
  expect(await requests[0].response()).toBeTruthy();
  expect(requests[0].frame() === page.mainFrame()).toBe(true);
  expect(requests[0].frame().url()).toBe(server.EMPTY_PAGE);
});

it('Page.Events.Response', async ({page, server}) => {
  const responses = [];
  page.on('response', response => responses.push(response));
  await page.goto(server.EMPTY_PAGE);
  expect(responses.length).toBe(1);
  expect(responses[0].url()).toBe(server.EMPTY_PAGE);
  expect(responses[0].status()).toBe(200);
  expect(responses[0].ok()).toBe(true);
  expect(responses[0].request()).toBeTruthy();
});

it('Page.Events.RequestFailed', async ({page, server, browserName, isMac, isWindows}) => {
  server.setRoute('/one-style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.connection.destroy();
  });
  const failedRequests = [];
  page.on('requestfailed', request => failedRequests.push(request));
  await page.goto(server.PREFIX + '/one-style.html');
  expect(failedRequests.length).toBe(1);
  expect(failedRequests[0].url()).toContain('one-style.css');
  expect(await failedRequests[0].response()).toBe(null);
  expect(failedRequests[0].resourceType()).toBe('stylesheet');
  if (browserName === 'chromium') {
    expect(failedRequests[0].failure().errorText).toBe('net::ERR_EMPTY_RESPONSE');
  } else if (browserName === 'webkit') {
    if (isMac)
      expect(failedRequests[0].failure().errorText).toBe('The network connection was lost.');
    else if (isWindows)
      expect(failedRequests[0].failure().errorText).toBe('Server returned nothing (no headers, no data)');
    else
      expect(failedRequests[0].failure().errorText).toBe('Message Corrupt');
  } else {
    expect(failedRequests[0].failure().errorText).toBe('NS_ERROR_NET_RESET');
  }
  expect(failedRequests[0].frame()).toBeTruthy();
});

it('Page.Events.RequestFinished', async ({page, server}) => {
  const [response] = await Promise.all([
    page.goto(server.EMPTY_PAGE),
    page.waitForEvent('requestfinished')
  ]);
  const request = response.request();
  expect(request.url()).toBe(server.EMPTY_PAGE);
  expect(await request.response()).toBeTruthy();
  expect(request.frame() === page.mainFrame()).toBe(true);
  expect(request.frame().url()).toBe(server.EMPTY_PAGE);
  expect(request.failure()).toBe(null);
});

it('should fire events in proper order', async ({page, server}) => {
  const events = [];
  page.on('request', request => events.push('request'));
  page.on('response', response => events.push('response'));
  const response = await page.goto(server.EMPTY_PAGE);
  expect(await response.finished()).toBe(null);
  events.push('requestfinished');
  expect(events).toEqual(['request', 'response', 'requestfinished']);
});

it('should support redirects', async ({page, server}) => {
  const events = [];
  page.on('request', request => events.push(`${request.method()} ${request.url()}`));
  page.on('response', response => events.push(`${response.status()} ${response.url()}`));
  page.on('requestfinished', request => events.push(`DONE ${request.url()}`));
  page.on('requestfailed', request => events.push(`FAIL ${request.url()}`));
  server.setRedirect('/foo.html', '/empty.html');
  const FOO_URL = server.PREFIX + '/foo.html';
  const response = await page.goto(FOO_URL);
  await response.finished();
  expect(events).toEqual([
    `GET ${FOO_URL}`,
    `302 ${FOO_URL}`,
    `DONE ${FOO_URL}`,
    `GET ${server.EMPTY_PAGE}`,
    `200 ${server.EMPTY_PAGE}`,
    `DONE ${server.EMPTY_PAGE}`
  ]);
  const redirectedFrom = response.request().redirectedFrom();
  expect(redirectedFrom.url()).toContain('/foo.html');
  expect(redirectedFrom.redirectedFrom()).toBe(null);
  expect(redirectedFrom.redirectedTo()).toBe(response.request());
});
