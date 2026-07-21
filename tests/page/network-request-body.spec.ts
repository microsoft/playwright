/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

it('should return correct request body buffer for utf-8 body', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const value = 'baẞ';
  const [request] = await Promise.all([
    page.waitForRequest('**'),
    page.evaluate(({ url, value }) => {
      const request = new Request(url, {
        method: 'POST',
        body: JSON.stringify(value),
      });
      request.headers.set('content-type', 'application/json;charset=UTF-8');
      return fetch(request);
    }, { url: server.PREFIX + '/title.html', value })
  ]);
  expect((await request.bodyBuffer()).equals(Buffer.from(JSON.stringify(value), 'utf-8'))).toBe(true);
  expect(await request.bodyJSON()).toBe(value);
});

it('should return request body w/o content-type @smoke', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest('**'),
    page.evaluate(({ url }) => {
      const request = new Request(url, {
        method: 'POST',
        body: JSON.stringify({ value: 42 }),
      });
      request.headers.set('content-type', '');
      return fetch(request);
    }, { url: server.PREFIX + '/title.html' })
  ]);
  expect(await request.bodyJSON()).toEqual({ value: 42 });
});

it('should throw on invalid JSON in post data', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest('**'),
    page.evaluate(({ url }) => {
      const request = new Request(url, {
        method: 'POST',
        body: '<not a json>',
      });
      return fetch(request);
    }, { url: server.PREFIX + '/title.html' })
  ]);
  let error;
  try {
    await request.bodyJSON();
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('POST data is not a valid JSON object: <not a json>');
});

it('should return body for PUT requests', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest('**'),
    page.evaluate(({ url }) => {
      const request = new Request(url, {
        method: 'PUT',
        body: JSON.stringify({ value: 42 }),
      });
      return fetch(request);
    }, { url: server.PREFIX + '/title.html' })
  ]);
  expect(await request.bodyJSON()).toEqual({ value: 42 });
});

it('should get request body for file/blob', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  it.fail(browserName === 'webkit', 'Blob request body is not reported in WebKit');
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest('**/*'),
    page.evaluate(() => {
      const file = new File(['file-contents'], 'filename.txt');

      void fetch('/data', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream'
        },
        body: file
      });
    })
  ]);
  expect(await request.body()).toBe('file-contents');
});

it('should get request body for navigator.sendBeacon api calls', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12231' });
  it.fail(browserName === 'webkit', 'body is empty');
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest('**/*'),
    page.evaluate(() => navigator.sendBeacon(window.location.origin + '/api/foo', new Blob([JSON.stringify({ foo: 'bar' })])))
  ]);
  expect(request.method()).toBe('POST');
  expect(request.url()).toBe(server.PREFIX + '/api/foo');
  expect(await request.bodyJSON()).toStrictEqual({ foo: 'bar' });
});

it('should return body for a binary blob request body', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  it.fail(browserName === 'webkit', 'Blob request body is not reported in WebKit');
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  const requestPromise = page.waitForRequest('**/post');
  await page.evaluate(async () => {
    const blob = new Blob([new Uint8Array(Array.from(Array(256).keys()))]);
    await fetch('./post', { method: 'POST', body: blob });
  });
  const request = await requestPromise;
  const buffer = await request.bodyBuffer();
  expect(buffer.length).toBe(256);
  for (let i = 0; i < 256; ++i)
    expect(buffer[i]).toBe(i);
});

it('should return body for a blob request body with interception', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  it.fail(browserName === 'webkit', 'Blob request body is not reported in WebKit');
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  await page.route('**/post', route => route.continue());
  const requestPromise = page.waitForRequest('**/post');
  await page.evaluate(async () => {
    const file = new File(['file-contents'], 'foo.txt', { type: 'application/octet-stream' });
    await fetch('./post', { method: 'POST', body: file });
  });
  const request = await requestPromise;
  expect(await request.body()).toBe('file-contents');
});

it('should return body for a blob request body after a redirect', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  it.fail(browserName === 'webkit', 'Blob request body is not reported in WebKit');
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/redirect', (req, res) => {
    res.writeHead(307, { location: '/post' });
    res.end();
  });
  server.setRoute('/post', (req, res) => res.end());
  const requestPromise = page.waitForRequest('**/post');
  await page.evaluate(async () => {
    const file = new File(['file-contents'], 'foo.txt', { type: 'application/octet-stream' });
    await fetch('./redirect', { method: 'POST', body: file });
  });
  const request = await requestPromise;
  expect(await request.body()).toBe('file-contents');
  expect(await request.redirectedFrom().body()).toBe('file-contents');
});

it('should return body for a form submission with a file input', async ({ page, server, asset, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  await page.setContent(`<form method="POST" action="/post" enctype="multipart/form-data">
    <input type="text" name="textfield" value="text-value">
    <input type="file" name="filefield">
    <input type="submit" value="Submit">
  </form>`);
  await page.setInputFiles('input[type=file]', asset('file-to-upload.txt'));
  const requestPromise = page.waitForRequest('**/post');
  await page.click('input[type=submit]');
  const request = await requestPromise;
  const body = await request.body();
  expect(body).toContain('Content-Disposition: form-data; name="textfield"\r\n\r\ntext-value');
  expect(body).toContain('Content-Disposition: form-data; name="filefield"; filename="file-to-upload.txt"');
  // Contents of files backed by disk are only reported in Firefox, Chromium and WebKit omit them.
  if (browserName === 'firefox')
    expect(body).toContain('contents of the file');
  else
    expect(body).not.toContain('contents of the file');
});

it('should return body for a fetch request with a file-backed FormData', async ({ page, server, asset, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  await page.setContent(`<input type="file">`);
  await page.setInputFiles('input', asset('file-to-upload.txt'));
  const requestPromise = page.waitForRequest('**/post');
  await page.evaluate(() => {
    const formData = new FormData();
    formData.append('textfield', 'text-value');
    formData.append('filefield', document.querySelector('input').files[0]);
    return fetch('/post', { method: 'POST', body: formData });
  });
  const request = await requestPromise;
  const body = await request.body();
  expect(body).toContain('Content-Disposition: form-data; name="textfield"\r\n\r\ntext-value');
  expect(body).toContain('Content-Disposition: form-data; name="filefield"; filename="file-to-upload.txt"');
  // Contents of files backed by disk are only reported in Firefox, Chromium and WebKit omit them.
  if (browserName === 'firefox')
    expect(body).toContain('contents of the file');
  else
    expect(body).not.toContain('contents of the file');
});

it('should return body for a cloned request', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  const requestPromise = page.waitForRequest('**/post');
  await page.evaluate(() => {
    // Cloning the request turns its body into a blob.
    const request = new Request('./post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ test: 'test' }),
    });
    return fetch(request.clone());
  });
  const request = await requestPromise;
  expect(await request.body()).toBe('{"test":"test"}');
  expect(await request.bodyJSON()).toEqual({ test: 'test' });
});

it('should not have body for a ReadableStream request body', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6479' });
  it.skip(browserName !== 'chromium', 'Streaming request bodies are only supported in Chromium');
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/post', (req, res) => res.end());
  const requestPromise = page.waitForRequest('**/post');
  await page.evaluate(() => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('stream-contents'));
        controller.close();
      }
    });
    // The fetch itself fails as streaming upload requires HTTP/2 or TLS, but the request is still sent.
    return fetch('./post', { method: 'POST', body: stream, duplex: 'half' } as RequestInit).catch(() => {});
  });
  const request = await requestPromise;
  expect(await request.body()).toBe(null);
  expect(await request.bodyBuffer()).toBe(null);
});
