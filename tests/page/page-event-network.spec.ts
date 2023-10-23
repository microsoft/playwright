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

import type { ServerResponse } from 'http';
import { test as it, expect } from './pageTest';
import { kTargetClosedErrorMessage } from '../config/errors';

it('Page.Events.Request @smoke', async ({ page, server }) => {
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

it('Page.Events.Response @smoke', async ({ page, server }) => {
  const responses = [];
  page.on('response', response => responses.push(response));
  await page.goto(server.EMPTY_PAGE);
  expect(responses.length).toBe(1);
  expect(responses[0].url()).toBe(server.EMPTY_PAGE);
  expect(responses[0].status()).toBe(200);
  expect(responses[0].ok()).toBe(true);
  expect(responses[0].request()).toBeTruthy();
});

it('Page.Events.RequestFailed @smoke', async ({ page, server, browserName, platform }) => {
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
    if (platform === 'linux')
      expect(failedRequests[0].failure().errorText).toMatch(/(Message Corrupt)|(Connection terminated unexpectedly)/i);
    else if (platform === 'darwin')
      expect(failedRequests[0].failure().errorText).toBe('The network connection was lost.');
    else if (platform === 'win32')
      expect(failedRequests[0].failure().errorText).toBe('Server returned nothing (no headers, no data)');
  } else {
    expect(failedRequests[0].failure().errorText).toBe('NS_ERROR_NET_RESET');
  }
  expect(failedRequests[0].frame()).toBeTruthy();
});

it('Page.Events.RequestFinished @smoke', async ({ page, server }) => {
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

it('should fire events in proper order', async ({ page, server }) => {
  const events = [];
  page.on('request', request => events.push('request'));
  page.on('response', response => events.push('response'));
  const response = await page.goto(server.EMPTY_PAGE);
  expect(await response.finished()).toBe(null);
  events.push('requestfinished');
  expect(events).toEqual(['request', 'response', 'requestfinished']);
});

it('should support redirects', async ({ page, server }) => {
  const FOO_URL = server.PREFIX + '/foo.html';
  const events = {};
  events[server.EMPTY_PAGE] = [];
  events[FOO_URL] = [];
  page.on('request', request => events[request.url()].push(request.method()));
  page.on('response', response => events[response.url()].push(response.status()));
  page.on('requestfinished', request => events[request.url()].push('DONE'));
  page.on('requestfailed', request => events[request.url()].push('FAIL'));

  server.setRedirect('/foo.html', '/empty.html');
  const response = await page.goto(FOO_URL);
  await response.finished();

  const expected = {};
  expected[FOO_URL] = ['GET', 302, 'DONE'];
  expected[server.EMPTY_PAGE] = ['GET', 200, 'DONE'];
  expect(events).toEqual(expected);
  const redirectedFrom = response.request().redirectedFrom();
  expect(redirectedFrom.url()).toContain('/foo.html');
  expect(redirectedFrom.redirectedFrom()).toBe(null);
  expect(redirectedFrom.redirectedTo()).toBe(response.request());
});

it('should resolve responses after a navigation', async ({ page, server, browserName }) => {
  it.fixme(browserName === 'chromium');
  const responseFromServerPromise = new Promise<ServerResponse>(resolve => {
    server.setRoute('/foo', (message, response) => {
      resolve(response);
    });
  });
  await page.goto(server.EMPTY_PAGE);
  const requestPromise = page.waitForRequest(() => true);
  // start a long running request and wait until it hits the server
  await page.evaluate(url => void fetch(url), server.PREFIX + '/foo');
  const responseFromServer = await responseFromServerPromise;
  const request = await requestPromise;
  const responsePromise = request.response();
  // navigate, which should cancel the request
  await page.goto(server.CROSS_PROCESS_PREFIX);
  // make sure we aren't stalling this request on the server
  responseFromServer.end('done');
  // the response should resolve to null, because the page navigated.
  expect(await responsePromise).toBe(null);
});

it('interrupt request.response() and request.allHeaders() on page.close', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27227' });
  server.setRoute('/one-style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
  });
  const reqPromise = page.waitForRequest('**/one-style.css');
  await page.goto(server.PREFIX + '/one-style.html', { waitUntil: 'domcontentloaded' });
  const req = await reqPromise;
  const respPromise = req.response().catch(e => e);
  const headersPromise = req.allHeaders().catch(e => e);
  await page.close();
  expect((await respPromise).message).toContain(kTargetClosedErrorMessage);
  // All headers are the same as "provisional" headers in Firefox.
  if (browserName === 'firefox')
    expect((await headersPromise)['user-agent']).toBeTruthy();
  else
    expect((await headersPromise).message).toContain(kTargetClosedErrorMessage);

});
