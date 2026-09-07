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
import type { ServerResponse } from 'http';
import type { server as coreServer } from '../../packages/playwright-core/lib/coreBundle';

it('should navigate to empty page with networkidle', async ({ page, server }) => {
  const response = await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
  expect(response.status()).toBe(200);
});

for (const inChildFrame of [false, true]) {
  it(`should wait for repeated networkidle in the ${inChildFrame ? 'child' : 'main'} frame`, async ({ page, server }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42598' });

    await page.goto(server.EMPTY_PAGE);
    if (inChildFrame)
      await page.setContent(`<iframe src="${server.EMPTY_PAGE}"></iframe><iframe src="${server.EMPTY_PAGE}"></iframe>`);
    await page.waitForLoadState('networkidle');
    const frame = inChildFrame ? page.frames()[1] : page.mainFrame();
    let responseA: ServerResponse;
    let responseB: ServerResponse;
    server.setRoute('/fetch-a', (req, res) => responseA = res);
    server.setRoute('/fetch-b', (req, res) => responseB = res);

    for (let i = 0; i < 3; ++i) {
      await Promise.all([
        server.waitForRequest('/fetch-a'),
        server.waitForRequest('/fetch-b'),
        page.waitForRequest(server.PREFIX + '/fetch-a'),
        page.waitForRequest(server.PREFIX + '/fetch-b'),
        frame.evaluate(() => {
          void fetch('/fetch-a');
          void fetch('/fetch-b');
        }),
      ]);
      let frameIdle = false;
      let pageIdle = false;
      const idlePromise = Promise.all([
        frame.waitForLoadState('networkidle').then(() => frameIdle = true),
        page.waitForLoadState('networkidle').then(() => pageIdle = true),
      ]);
      // Round trips let an incorrectly resolved wait settle while requests are held.
      await page.evaluate(() => 1);
      expect(frameIdle).toBe(false);
      expect(pageIdle).toBe(false);

      const requestFinished = page.waitForEvent('requestfinished', request => request.url().endsWith('/fetch-a'));
      responseA.end('a');
      await requestFinished;
      await page.evaluate(() => 1);
      expect(frameIdle).toBe(false);
      expect(pageIdle).toBe(false);

      let timerTriggered = false;
      const timer = setTimeout(() => timerTriggered = true, 500);
      try {
        responseB.end('b');
        await idlePromise;
        expect(timerTriggered).toBe(true);
      } finally {
        clearTimeout(timer);
      }
    }
  });
}

it('should notify networkidle transitions once and recover when a busy frame detaches', async ({ page, server, toImpl }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<iframe src="${server.EMPTY_PAGE}"></iframe>`, { waitUntil: 'networkidle' });
  const frame = page.frames()[1];
  const events: string[] = [];
  for (const [name, target] of [['main', page.mainFrame()], ['child', frame]] as const) {
    const impl: coreServer.Frame = toImpl(target);
    impl.on('addlifecycle', event => {
      if (event === 'networkidle')
        events.push(`${name}:idle`);
    });
    impl.on('removelifecycle', event => {
      if (event === 'networkidle')
        events.push(`${name}:busy`);
    });
  }

  let responseA: ServerResponse;
  let responseB: ServerResponse;
  server.setRoute('/fetch-a', (req, res) => responseA = res);
  server.setRoute('/fetch-b', (req, res) => responseB = res);
  await Promise.all([
    server.waitForRequest('/fetch-a'),
    server.waitForRequest('/fetch-b'),
    page.waitForRequest(server.PREFIX + '/fetch-a'),
    page.waitForRequest(server.PREFIX + '/fetch-b'),
    frame.evaluate(() => {
      void fetch('/fetch-a');
      void fetch('/fetch-b');
    }),
  ]);
  expect(events).toEqual(['child:busy', 'main:busy']);

  const requestFinished = page.waitForEvent('requestfinished', request => request.url().endsWith('/fetch-a'));
  responseA.end('a');
  await requestFinished;
  expect(events).toEqual(['child:busy', 'main:busy']);
  responseB.end('b');
  await page.waitForLoadState('networkidle');
  expect(events).toEqual(['child:busy', 'main:busy', 'child:idle', 'main:idle']);
  events.length = 0;

  const [request] = await Promise.all([
    page.waitForRequest(server.PREFIX + '/fetch-a'),
    frame.evaluate(() => { void fetch('/fetch-a'); }),
  ]);
  expect(events).toEqual(['child:busy', 'main:busy']);
  await Promise.all([
    page.waitForEvent('requestfailed', failed => failed === request),
    page.waitForEvent('framedetached', detached => detached === frame),
    page.evaluate(() => document.querySelector('iframe').remove()),
  ]);
  await page.waitForLoadState('networkidle');
  expect(events).toEqual(['child:busy', 'main:busy', 'main:idle']);
});

async function networkIdleTest(frame: Frame, server: TestServer, action: () => Promise<any>, isSetContent?: boolean) {
  const waitForRequest = (suffix: string) => {
    return Promise.all([
      server.waitForRequest(suffix),
      frame.page().waitForRequest(server.PREFIX + suffix),
    ]);
  };

  let responseA;
  let responseB;
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

it('should not wait for an open EventSource connection', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/37226' });

  server.setRoute('/sse', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    });
    res.write('data: hello\n\n');
  });
  server.setRoute('/sse-page.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>new EventSource('/sse');</script>`);
  });

  const response = await page.goto(server.PREFIX + '/sse-page.html', { waitUntil: 'networkidle' });
  expect(response.status()).toBe(200);
});

it('should not wait for an open EventSource connection in setContent', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/37226' });

  server.setRoute('/sse', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    });
    res.write('data: hello\n\n');
  });

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<script>
    window.__sseOpened = new Promise(resolve => {
      const es = new EventSource('/sse');
      es.onmessage = () => resolve();
    });
  </script>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window['__sseOpened']);
});
