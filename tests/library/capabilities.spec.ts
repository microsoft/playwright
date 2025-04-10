/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import os, { platform } from 'os';
import path from 'path';
import { contextTest as it, expect } from '../config/browserTest';
import { hostPlatform } from '../../packages/playwright-core/src/server/utils/hostPlatform';

it('SharedArrayBuffer should work @smoke', async function({ contextFactory, httpsServer }) {
  const context = await contextFactory({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  httpsServer.setRoute('/sharedarraybuffer', (req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.end();
  });
  await page.goto(httpsServer.PREFIX + '/sharedarraybuffer');
  expect(await page.evaluate(() => typeof SharedArrayBuffer)).toBe('function');
});

it('Web Assembly should work @smoke', async ({ page, server, browserName, platform }) => {
  it.fixme(browserName === 'webkit' && platform === 'win32', 'Windows JIT is disabled: https://bugs.webkit.org/show_bug.cgi?id=273854');
  await page.goto(server.PREFIX + '/wasm/table2.html');
  expect(await page.evaluate('loadTable()')).toBe('42, 83');
});

it('WebSocket should work @smoke', async ({ page, server }) => {
  server.sendOnWebSocketConnection('incoming');
  const value = await page.evaluate(port => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    ws.addEventListener('error', error => cb('Error'));
    return result;
  }, server.PORT);
  expect(value).toBe('incoming');
});

it('should respect CSP @smoke', async ({ page, server }) => {
  server.setRoute('/empty.html', async (req, res) => {
    res.setHeader('Content-Security-Policy', `script-src 'unsafe-inline';`);
    res.end(`
      <script>
        window.testStatus = 'SUCCESS';
        window.testStatus = eval("'FAILED'");
      </script>`);
  });

  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => window['testStatus'])).toBe('SUCCESS');
});

it('should support webgl @smoke', async ({ page, browserName, platform }) => {
  it.fixme(browserName === 'chromium' && platform === 'darwin' && os.arch() === 'arm64', 'SwiftShader is not available on macOS-arm64 - https://github.com/microsoft/playwright/issues/28216');
  const hasWebGL = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl');
  });
  expect(hasWebGL).toBe(true);
});

it('should support webgl 2 @smoke', async ({ page, browserName, headless, isWindows, platform }) => {
  it.skip(browserName === 'webkit', 'WebKit doesn\'t have webgl2 enabled yet upstream.');
  it.fixme(browserName === 'firefox' && isWindows);
  it.fixme(browserName === 'chromium' && !headless, 'chromium doesn\'t like webgl2 when running under xvfb');
  it.fixme(browserName === 'chromium' && platform === 'darwin' && os.arch() === 'arm64', 'SwiftShader is not available on macOS-arm64 - https://github.com/microsoft/playwright/issues/28216');

  const hasWebGL2 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  });
  expect(hasWebGL2).toBe(true);
});

it('should not crash on page with mp4 @smoke', async ({ page, server, platform, browserName }) => {
  it.fixme(browserName === 'webkit' && platform === 'win32', 'https://github.com/microsoft/playwright/issues/11009, times out in setContent');
  await page.setContent(`<video><source src="${server.PREFIX}/video/big-buck-bunny-h264.mp4"/></video>`);
  await page.waitForTimeout(1000);
});

it('should not crash on showDirectoryPicker', async ({ page, server, browserName, browserMajorVersion }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/7339' });
  it.skip(browserName === 'chromium' && browserMajorVersion < 99, 'Fixed in Chromium r956769');
  it.skip(browserName !== 'chromium', 'showDirectoryPicker is only available in Chromium');
  await page.goto(server.EMPTY_PAGE);
  // "User activation is required to show a file picker." - so we click first.
  await page.locator('body').click();
  page.evaluate(async () => {
    const dir = await (window as any).showDirectoryPicker();
    return dir.name;
    // In headless it throws (aborted), in headed it stalls (Test ended) and waits for the picker to be accepted.
  }).catch(e => expect(e.message).toMatch(/((DOMException|AbortError): .*The user aborted a request|Test ended)/));
  // The dialog will not be accepted, so we just wait for some time to
  // to give the browser a chance to crash.
  await page.waitForTimeout(3_000);
});

it('should not crash on storage.getDirectory()', async ({ page, server, browserName, isMac }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18235' });
  it.skip(browserName === 'firefox', 'navigator.storage.getDirectory is not a function');
  await page.goto(server.EMPTY_PAGE);
  const error = await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    return dir.name;
  }).catch(e => e);
  if (browserName === 'webkit') {
    if (isMac)
      expect(error.message).toContain('UnknownError: The operation failed for an unknown transient reason');
    else
      expect(error.message).toContain('TypeError: undefined is not an object');
  } else {
    expect(error).toBeFalsy();
  }
});

it('navigator.clipboard should be present', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18901' });
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => navigator.clipboard)).toBeTruthy();
});

it('should set CloseEvent.wasClean to false when the server terminates a WebSocket connection', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12353' });
  server.onceWebSocketConnection(socket => {
    socket.terminate();
  });
  const wasClean = await page.evaluate(port => new Promise<boolean>(resolve => {
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('close', error => resolve(error.wasClean));
  }), server.PORT);
  expect(wasClean).toBe(false);
});

it('serviceWorker should intercept document request', async ({ page, server }) => {
  server.setRoute('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`
      self.addEventListener('fetch', event => {
        event.respondWith(new Response('intercepted'));
      });
      self.addEventListener('activate', event => {
        event.waitUntil(clients.claim());
      });
    `);
  });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);
  });
  await page.reload();
  expect(await page.textContent('body')).toBe('intercepted');
});

it('webkit should define window.safari', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21037' });
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29032' });
  it.skip(browserName !== 'webkit');
  await page.goto(server.EMPTY_PAGE);
  const defined = await page.evaluate(() => !!(window as any).safari);
  expect(defined).toBeTruthy();
  expect(await page.evaluate(() => typeof (window as any).safari.pushNotification)).toBe('object');
  expect(await page.evaluate(() => (window as any).safari.pushNotification.toString())).toBe('[object SafariRemoteNotification]');
});

it('make sure that XMLHttpRequest upload events are emitted correctly', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21489' });

  await page.goto(server.EMPTY_PAGE);
  const events = await page.evaluate(async () => {
    const events: string[] = [];
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('loadstart', () => events.push('loadstart'));
    xhr.upload.addEventListener('progress', () => events.push('progress'));
    xhr.upload.addEventListener('load', () => events.push('load'));
    xhr.upload.addEventListener('loadend', () => events.push('loadend'));
    xhr.open('POST', '/simple.json');
    xhr.send('hello');
    await new Promise(f => xhr.onload = f);
    return events;
  });
  expect(events).toEqual(['loadstart', 'progress', 'load', 'loadend']);
});

it('loading in HTMLImageElement.prototype', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22738' });
  await page.goto(server.EMPTY_PAGE);
  const defined = await page.evaluate(() => 'loading' in HTMLImageElement.prototype);
  expect(defined).toBeTruthy();
});

it('window.GestureEvent in WebKit', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22735' });
  await page.goto(server.EMPTY_PAGE);
  const defined = await page.evaluate(() => 'GestureEvent' in window);
  expect(defined).toBe(browserName === 'webkit');
  const type = await page.evaluate(() => typeof (window as any).GestureEvent);
  expect(type).toBe(browserName === 'webkit' ? 'function' : 'undefined');
});

it('requestFullscreen', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22832' });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    const result = new Promise(resolve => document.addEventListener('fullscreenchange', resolve));
    void document.documentElement.requestFullscreen();
    return result;
  });
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBeTruthy();
  await page.evaluate(() => {
    const result = new Promise(resolve => document.addEventListener('fullscreenchange', resolve));
    void document.exitFullscreen();
    return result;
  });
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBeFalsy();
});

it('should send no Content-Length header for GET requests with a Content-Type', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22569' });
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.evaluate(() => fetch('/empty.html', {
      'headers': { 'Content-Type': 'application/json' },
      'method': 'GET'
    }))
  ]);
  expect(request.headers['content-length']).toBe(undefined);
});

it('Intl.ListFormat should work', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23978' });
  it.skip(browserName === 'webkit' && hostPlatform.startsWith('ubuntu20.04'), 'libicu is too old and WebKit disables Intl.ListFormat by default then');
  await page.goto(server.EMPTY_PAGE);
  const formatted = await page.evaluate(() => {
    const data = ['first', 'second', 'third'];
    const listFormat = new Intl.ListFormat('en', {
      type: 'disjunction',
      style: 'short',
    });
    return listFormat.format(data);
  });
  expect(formatted).toBe('first, second, or third');
});

it('service worker should cover the iframe', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29267' });

  server.setRoute('/sw.html', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`
      <script>
        window.registrationPromise = navigator.serviceWorker.register('sw.js');
        window.activationPromise = new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);
      </script>
    `);
  });

  server.setRoute('/iframe.html', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<div>from the server</div>`);
  });

  server.setRoute('/sw.js', (req, res) => {
    res.writeHead(200, { 'content-type': 'application/javascript' }).end(`
      const kIframeHtml = "<div>from the service worker</div>";

      self.addEventListener('fetch', event => {
        if (event.request.url.endsWith('iframe.html')) {
          const blob = new Blob([kIframeHtml], { type: 'text/html' });
          const response = new Response(blob, { status: 200 , statusText: 'OK' });
          event.respondWith(response);
          return;
        }
        event.respondWith(fetch(event.request));
      });

      self.addEventListener('activate', event => {
        event.waitUntil(clients.claim());
      });
    `);
  });

  await page.goto(server.PREFIX + '/sw.html');
  await page.evaluate(() => window['activationPromise']);

  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = '/iframe.html';
    document.body.appendChild(iframe);
  });

  await expect(page.frameLocator('iframe').locator('div')).toHaveText('from the service worker');
});

it('service worker should register in an iframe', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29267' });

  server.setRoute('/main.html', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`
      <iframe src='/dir/iframe.html'></iframe>
    `);
  });

  server.setRoute('/dir/iframe.html', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`
      <script>
        window.registrationPromise = navigator.serviceWorker.register('sw.js');
        window.activationPromise = new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);
      </script>
    `);
  });

  server.setRoute('/dir/sw.js', (req, res) => {
    res.writeHead(200, { 'content-type': 'application/javascript' }).end(`
      const kIframeHtml = "<div>from the service worker</div>";

      self.addEventListener('fetch', event => {
        if (event.request.url.endsWith('html')) {
          event.respondWith(fetch(event.request));
          return;
        }
        const blob = new Blob(['responseFromServiceWorker'], { type: 'text/plain' });
        const response = new Response(blob, { status: 200 , statusText: 'OK' });
        event.respondWith(response);
      });

      self.addEventListener('activate', event => {
        event.waitUntil(clients.claim());
      });
    `);
  });

  await page.goto(server.PREFIX + '/main.html');
  const iframe = page.frames()[1];
  await iframe.evaluate(() => window['activationPromise']);

  const response = await iframe.evaluate(async () => {
    const response = await fetch('foo.txt');
    return response.text();
  });
  expect(response).toBe('responseFromServiceWorker');
});

it('should be able to render avif images', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/32673',
  }
}, async ({ page, server, browserName, platform }) => {
  it.fixme(browserName === 'webkit' && platform === 'win32');
  it.skip(browserName === 'webkit' && hostPlatform.startsWith('ubuntu20.04'), 'Ubuntu 20.04 is frozen');
  it.skip(browserName === 'webkit' && hostPlatform.startsWith('debian11'), 'Debian 11 is too old');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<img src="${server.PREFIX}/rgb.avif" onerror="window.error = true">`);
  await expect.poll(() => page.locator('img').boundingBox()).toEqual(expect.objectContaining({
    width: 128,
    height: 128,
  }));
  expect(await page.evaluate(() => (window as any).error)).toBe(undefined);
});

it('should not crash when clicking a label with a <input type="file"/>', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/33257'
  }
}, async ({ page }) => {
  await page.setContent(`
    <form>
      <label>
        A second file
        <input type="file" />
      </label>
    </form>
  `);
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('A second file').click();
  const fileChooser = await fileChooserPromise;
  expect(fileChooser.page()).toBe(page);
});

it('should not crash when clicking a color input', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/33864'
  }
}, async ({ page, browserMajorVersion, browserName }) => {
  it.skip(browserName === 'firefox' && browserMajorVersion < 135);

  await page.setContent('<input type="color">');
  const input = page.locator('input');

  await expect(input).toBeVisible();
  await input.click();
  await expect(input).toBeVisible();
});

it('should not auto play audio', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/33590'
  }
}, async ({ page, browserName, isWindows }) => {
  it.fixme(browserName === 'webkit' && isWindows);
  it.skip(process.env.PW_CLOCK === 'frozen', 'no way to inject real setTimeout');
  await page.route('**/*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
      <script>
        async function onLoad() {
          const log = document.getElementById('log');
          const audioContext = new AudioContext();
          const gainNode = new GainNode(audioContext);
          gainNode.connect(audioContext.destination);
          gainNode.gain.value = 0.025;
          const sineNode = new OscillatorNode(audioContext);
          sineNode.connect(gainNode);
          sineNode.start();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          log.innerHTML = 'State: ' + audioContext.state;
        }
      </script>
      <body onload="onLoad()">
      <div id="log"></div>
      </body>`,
    });
  });
  await page.goto('http://127.0.0.1/audio.html');
  await expect(page.locator('#log')).toHaveText('State: suspended');
});

it.describe('Audio & Video codec playback', () => {
  for (const { codec, file, type, skip } of [
    {
      codec: 'H.264 (MKV container)',
      file: '/video/big-buck-bunny-h264.mkv',
      type: 'video/mp4',
      skip: ({ browserName, channel }) =>
        browserName === 'chromium' && !channel, // Prorietary codec
    },
    {
      codec: 'H.264 (MP4 container)',
      file: '/video/big-buck-bunny-h264.mp4',
      skip: ({ browserName, channel }) =>
        browserName === 'chromium' && !channel  // Prorietary codec
    },
    {
      codec: 'HEVC (MP4 container)',
      file: '/video/big-buck-bunny-hevc.mp4',
      skip: ({ browserName, channel, platform }) =>
        browserName === 'chromium' && !channel // Prorietary codec
       || browserName === 'webkit' && platform === 'darwin' // TODO
    },
    {
      codec: 'VP9 (WebM container)',
      file: '/video/big-buck-bunny-vp9.webm',
      skip: ({ browserName, channel, platform }) =>
        browserName === 'webkit' && platform === 'linux' // TODO
    },
    {
      codec: 'AV1 (MP4 container)',
      file: '/video/big-buck-bunny-av1.mp4',
      skip: ({ browserName, platform }) =>
        browserName === 'webkit' && platform === 'darwin',
    },
    {
      codec: 'VP8 (WebM container)',
      file: '/video/movie-vp8.webm' },
  ] as const) {
    it(`should play ${codec} video`, async ({ page, server, browserName, channel, platform }) => {
      it.skip(skip?.({ browserName, channel, platform }));

      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`
        <video id="test-video" controls>
          <source src="${server.PREFIX + file}" type="${type ?? `video/${path.extname(file).slice(1)}`}">
        </video>
      `);
      const video = page.locator('#test-video');
      await video.evaluate(async (v: HTMLVideoElement) => {
        await v.play();
        await new Promise((resolve, reject) => {
          v.addEventListener('ended', resolve);
          v.addEventListener('error', reject);
        });
      });
      const currentTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(currentTime).toBeGreaterThan(0);
    });
  }

  for (const { codec, file, type, skip } of [
    {
      codec: 'Theora (OGV container)',
      file: '/audio/movie.ogv',
      type: 'video/ogg',
      skip: ({ browserName, platform }) =>
        browserName === 'webkit' && platform === 'darwin' // TODO
      || browserName === 'firefox' && platform === 'linux' // TODO
      || browserName === 'firefox' && platform === 'darwin', // TODO
    },
    {
      codec: 'MP3 (MP3 container)',
      file: '/audio/example.mp3',
      type: 'audio/mpeg',
      skip: ({ browserName, platform }) =>
        browserName === 'firefox' && platform === 'linux' // TODO
    },
  ]) {
    it(`should play ${codec} audio`, async ({ page, server, browserName, platform }) => {
      it.skip(skip?.({ browserName, platform }));

      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`
        <audio id="test-audio" controls>
          <source src="${server.PREFIX + file}" type="${type ?? `audio/${path.extname(file).slice(1)}`}">
        </video>
      `);
      const audio = page.locator('#test-audio');
      await audio.evaluate(async (a: HTMLAudioElement) => {
        await a.play();
        await new Promise((resolve, reject) => {
          a.addEventListener('ended', resolve);
          a.addEventListener('error', reject);
        });
      });
      const currentTime = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
      expect(currentTime).toBeGreaterThan(0);
    });
  }
});
