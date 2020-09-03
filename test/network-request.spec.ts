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

import { it, options } from './playwright.fixtures';
import utils from './utils';

it('should work for main frame navigation request', async ({page, server}) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
  expect(requests[0].frame()).toBe(page.mainFrame());
});

it('should work for subframe navigation request', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  const requests = [];
  page.on('request', request => requests.push(request));
  await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
  expect(requests[0].frame()).toBe(page.frames()[1]);
});

it('should work for fetch requests', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  let requests = [];
  page.on('request', request => requests.push(request));
  await page.evaluate(() => fetch('/digits/1.png'));
  requests = requests.filter(request => !request.url().includes('favicon'));
  expect(requests.length).toBe(1);
  expect(requests[0].frame()).toBe(page.mainFrame());
});

it('should return headers', async ({page, server}) => {
  const response = await page.goto(server.EMPTY_PAGE);
  if (options.CHROMIUM)
    expect(response.request().headers()['user-agent']).toContain('Chrome');
  else if (options.FIREFOX)
    expect(response.request().headers()['user-agent']).toContain('Firefox');
  else if (options.WEBKIT)
    expect(response.request().headers()['user-agent']).toContain('WebKit');
});

it('should get the same headers as the server', test => {
  test.fail(options.CHROMIUM || options.WEBKIT);
}, async ({page, server}) => {
  await page.goto(server.PREFIX + '/empty.html');
  let serverRequest;
  server.setRoute('/something', (request, response) => {
    serverRequest = request;
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('done');
  });
  const requestPromise = page.waitForEvent('request');
  const text = await page.evaluate(async url => {
    const data = await fetch(url);
    return data.text();
  }, server.CROSS_PROCESS_PREFIX + '/something');
  const request = await requestPromise;
  expect(text).toBe('done');
  expect(request.headers()).toEqual(serverRequest.headers);
});

it('should return postData', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  let request = null;
  page.on('request', r => request = r);
  await page.evaluate(() => fetch('./post', { method: 'POST', body: JSON.stringify({foo: 'bar'})}));
  expect(request).toBeTruthy();
  expect(request.postData()).toBe('{"foo":"bar"}');
});

it('should work with binary post data', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  let request = null;
  page.on('request', r => request = r);
  await page.evaluate(async () => {
    await fetch('./post', { method: 'POST', body: new Uint8Array(Array.from(Array(256).keys())) });
  });
  expect(request).toBeTruthy();
  const buffer = request.postDataBuffer();
  expect(buffer.length).toBe(256);
  for (let i = 0; i < 256; ++i)
    expect(buffer[i]).toBe(i);
});

it('should work with binary post data and interception', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  let request = null;
  await page.route('/post', route => route.continue());
  page.on('request', r => request = r);
  await page.evaluate(async () => {
    await fetch('./post', { method: 'POST', body: new Uint8Array(Array.from(Array(256).keys())) });
  });
  expect(request).toBeTruthy();
  const buffer = request.postDataBuffer();
  expect(buffer.length).toBe(256);
  for (let i = 0; i < 256; ++i)
    expect(buffer[i]).toBe(i);
});

it('should be |undefined| when there is no post data', async ({page, server}) => {
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.request().postData()).toBe(null);
});

it('should parse the json post data', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  let request = null;
  page.on('request', r => request = r);
  await page.evaluate(() => fetch('./post', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) }));
  expect(request).toBeTruthy();
  expect(request.postDataJSON()).toEqual({ 'foo': 'bar' });
});

it('should parse the data if content-type is application/x-www-form-urlencoded', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  let request = null;
  page.on('request', r => request = r);
  await page.setContent(`<form method='POST' action='/post'><input type='text' name='foo' value='bar'><input type='number' name='baz' value='123'><input type='submit'></form>`);
  await page.click('input[type=submit]');
  expect(request).toBeTruthy();
  expect(request.postDataJSON()).toEqual({'foo': 'bar','baz': '123'});
});

it('should be |undefined| when there is no post data', async ({ page, server }) => {
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.request().postDataJSON()).toBe(null);
});

it('should return event source', async ({page, server}) => {
  const SSE_MESSAGE = {foo: 'bar'};
  // 1. Setup server-sent events on server that immediately sends a message to the client.
  server.setRoute('/sse', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    });
    res.write(`data: ${JSON.stringify(SSE_MESSAGE)}\n\n`);
  });
  // 2. Subscribe to page request events.
  await page.goto(server.EMPTY_PAGE);
  const requests = [];
  page.on('request', request => requests.push(request));
  // 3. Connect to EventSource in browser and return first message.
  expect(await page.evaluate(() => {
    const eventSource = new EventSource('/sse');
    return new Promise(resolve => {
      eventSource.onmessage = e => resolve(JSON.parse(e.data));
    });
  })).toEqual(SSE_MESSAGE);
  expect(requests[0].resourceType()).toBe('eventsource');
});

it('should return navigation bit', async ({page, server}) => {
  const requests = new Map();
  page.on('request', request => requests.set(request.url().split('/').pop(), request));
  server.setRedirect('/rrredirect', '/frames/one-frame.html');
  await page.goto(server.PREFIX + '/rrredirect');
  expect(requests.get('rrredirect').isNavigationRequest()).toBe(true);
  expect(requests.get('one-frame.html').isNavigationRequest()).toBe(true);
  expect(requests.get('frame.html').isNavigationRequest()).toBe(true);
  expect(requests.get('script.js').isNavigationRequest()).toBe(false);
  expect(requests.get('style.css').isNavigationRequest()).toBe(false);
});

it('should return navigation bit when navigating to image', async ({page, server}) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.PREFIX + '/pptr.png');
  expect(requests[0].isNavigationRequest()).toBe(true);
});
