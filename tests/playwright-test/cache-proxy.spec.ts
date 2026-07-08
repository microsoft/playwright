/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';

async function startUpstreamProxy(): Promise<{ url: string, log: string[], stop: () => Promise<void> }> {
  const log: string[] = [];
  const server = http.createServer((req, res) => {
    res.writeHead(502);
    res.end();
  });
  server.on('connect', (req, socket, head) => {
    log.push(req.url!);
    const [host, port] = req.url!.split(':');
    // 'localhost' resolves to ::1 first, but test servers listen on IPv4.
    const target = net.connect({ port: Number(port), host, family: 4 }, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length)
        target.write(head);
      socket.pipe(target);
      target.pipe(socket);
    });
    target.on('error', () => socket.destroy());
    socket.on('error', () => target.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
  return { url, log, stop: () => new Promise(resolve => server.close(() => resolve())) };
}

const loadImage = `src => new Promise(f => { const img = document.createElement('img'); img.onload = img.onerror = f; img.src = src; })`;
const loadScript = `src => new Promise(f => { const s = document.createElement('script'); s.onload = s.onerror = f; s.src = src; document.head.appendChild(s); })`;

// httpCache bypasses loopback, so tests reach the local server through a
// non-loopback name that still resolves to 127.0.0.1 - forcing traffic through
// the caching proxy the way a remote (staging) host would.
const HOST = 'fake-localhost-127-0-0-1.nip.io';
const remote = (server: { PORT: number }, tls = false) => `${tls ? 'https' : 'http'}://${HOST}:${server.PORT}`;
const remoteHost = (server: { PORT: number }) => `${HOST}:${server.PORT}`;

test('should record and replay responses across runs', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  httpsServer.setRoute('/asset.png', (req, res) => {
    ++hits;
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end('payload');
  });

  const files = {
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/asset.png');
      });
    `,
  };

  const result1 = await runInlineTest(files, { workers: 1 });
  expect(result1.exitCode).toBe(0);
  expect(hits).toBe(1);
  expect(fs.existsSync(path.join(cacheDir, 'index.jsonl'))).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(cacheDir, 'meta.json'), 'utf8')).version).toBe(1);

  const hitsAfterRecord = hits;
  const result2 = await runInlineTest(files, { workers: 1 });
  expect(result2.exitCode).toBe(0);
  expect(hits).toBe(hitsAfterRecord); // Served entirely from cache, no new httpsServer hit.

  fs.writeFileSync(path.join(cacheDir, 'meta.json'), JSON.stringify({ version: 999 }));
  const result3 = await runInlineTest(files, { workers: 1 });
  expect(result3.exitCode).toBe(0);
  expect(hits).toBe(hitsAfterRecord + 1); // Went back to the httpsServer.
});

test('should cache https responses via MITM', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  httpsServer.setRoute('/secure.png', (req, res) => {
    ++hits;
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end('secure payload');
  });

  const files = {
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/secure.png');
      });
    `,
  };

  const result1 = await runInlineTest(files, { workers: 1 });
  expect(result1.exitCode).toBe(0);
  expect(hits).toBe(1); // Proxy terminated TLS, fetched once, cached.

  const hitsAfterRecord = hits;
  const result2 = await runInlineTest(files, { workers: 1 });
  expect(result2.exitCode).toBe(0);
  expect(hits).toBe(hitsAfterRecord); // Replayed from cache over HTTPS, no new hit.
});

test('should tunnel secure WebSockets through the MITM proxy', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  httpsServer.onceWebSocketConnection(ws => ws.on('message', () => ws.send('pong')));

  const result = await runInlineTest({
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('wss', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        const echoed = await page.evaluate(host => new Promise(resolve => {
          const ws = new WebSocket('wss://' + host + '/ws');
          ws.onopen = () => ws.send('ping');
          ws.onmessage = e => resolve(e.data);
          ws.onerror = () => resolve('error');
        }), '${remoteHost(httpsServer)}');
        expect(echoed).toBe('pong');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should tunnel plaintext WebSockets', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  server.onceWebSocketConnection(ws => ws.on('message', () => ws.send('pong')));

  const result = await runInlineTest({
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('ws', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        const echoed = await page.evaluate(host => new Promise(resolve => {
          const ws = new WebSocket('ws://' + host + '/ws');
          ws.onopen = () => ws.send('ping');
          ws.onmessage = e => resolve(e.data);
          ws.onerror = () => resolve('error');
        }), '${remoteHost(server)}');
        expect(echoed).toBe('pong');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should stream non-storable responses without buffering', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  // A response that emits a chunk and then never ends; buffering would hang.
  server.setRoute('/stream', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.write('first-chunk');
  });

  const result = await runInlineTest({
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('stream', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        const chunk = await page.evaluate(async () => {
          const res = await fetch('/stream');
          const reader = res.body.getReader();
          const { value } = await reader.read();
          await reader.cancel();
          return new TextDecoder().decode(value);
        });
        expect(chunk).toBe('first-chunk');
      });
    `,
  }, { workers: 1, timeout: 15000 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should cache only shared static assets by default', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  const counts: Record<string, number> = { asset: 0, xhr: 0, private: 0, cookie: 0, noStore: 0 };
  httpsServer.setRoute('/asset', (req, res) => { ++counts.asset; res.end('a'); });
  httpsServer.setRoute('/api/data', (req, res) => { ++counts.xhr; res.end('data'); });
  httpsServer.setRoute('/private', (req, res) => { ++counts.private; res.writeHead(200, { 'cache-control': 'private' }); res.end('a'); });
  httpsServer.setRoute('/cookie', (req, res) => { ++counts.cookie; res.writeHead(200, { 'set-cookie': 'sid=1' }); res.end('a'); });
  httpsServer.setRoute('/no-store', (req, res) => { ++counts.noStore; res.writeHead(200, { 'cache-control': 'no-store' }); res.end('a'); });

  const files = {
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        // Loaded as image subresources (Sec-Fetch-Dest: image).
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/asset');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/private');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/cookie');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/no-store');
        // Loaded as an XHR/fetch (Sec-Fetch-Dest: empty).
        await page.evaluate(() => fetch('/api/data').then(r => r.text()));
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  await runInlineTest(files, { workers: 1 });
  expect(counts.asset).toBe(1);   // Static subresource -> cached, replayed.
  expect(counts.xhr).toBe(2);     // fetch/XHR -> not cached by default.
  expect(counts.private).toBe(2); // Cache-Control: private -> personalized, not cached.
  expect(counts.cookie).toBe(2);  // Set-Cookie -> personalized, not cached.
  expect(counts.noStore).toBe(2); // Cache-Control: no-store -> never cached.
});

test('should isolate cached entries by identity', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  server.setRoute('/me', (req, res) => { ++hits; res.end('user:' + (req.headers['x-user'] || 'guest')); });

  const files = {
    'playwright.config.ts': `export default { httpCache: {
      dir: ${JSON.stringify(cacheDir)},
      match: request => ({ disposition: 'cache', identity: request.headers.get('x-user') }),
    } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        const fetchAs = user => page.evaluate(u =>
          fetch('/me', { headers: { 'x-user': u } }).then(r => r.text()), user);
        expect(await fetchAs('alice')).toBe('user:alice');
        expect(await fetchAs('bob')).toBe('user:bob');
        expect(await fetchAs('alice')).toBe('user:alice'); // Alice's own entry, not bob's.
        expect(await fetchAs('')).toBe('user:guest');      // Guest identity -> its own namespace.
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  expect(hits).toBe(3); // alice, bob, guest each fetched once; the repeat 'alice' was a hit.

  await runInlineTest(files, { workers: 1 });
  expect(hits).toBe(3); // All three identities replayed from cache.
});

test('should key cached variants by Vary', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  server.setRoute('/variant', (req, res) => {
    ++hits;
    res.writeHead(200, { 'vary': 'x-variant' });
    res.end('variant:' + (req.headers['x-variant'] || 'none'));
  });

  const files = {
    // Force-cache so the fetch is stored; this isolates the Vary keying.
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)}, match: () => ({ disposition: 'cache' }) } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        const fetchVariant = v => page.evaluate(variant =>
          fetch('/variant', { headers: { 'x-variant': variant } }).then(r => r.text()), v);
        expect(await fetchVariant('a')).toBe('variant:a');
        expect(await fetchVariant('b')).toBe('variant:b');
        expect(await fetchVariant('a')).toBe('variant:a'); // From cache, still the 'a' body.
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  expect(hits).toBe(2); // Two distinct variants fetched once each; the repeat 'a' was a hit.

  await runInlineTest(files, { workers: 1 });
  expect(hits).toBe(2); // Both variants replayed from cache.
});

test('should not cache Vary: * responses', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  server.setRoute('/star', (req, res) => {
    ++hits;
    res.writeHead(200, { 'vary': '*' });
    res.end('a');
  });

  const files = {
    // Even when caching is forced, Vary: * is hard-blocked and never stored.
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)}, match: () => ({ disposition: 'cache' }) } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        await page.evaluate(() => fetch('/star').then(r => r.text()));
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  await runInlineTest(files, { workers: 1 });
  expect(hits).toBe(2); // Vary: * is not storable -> network every run.
});

test('should cache redirects', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let redirects = 0;
  server.setRoute('/old', (req, res) => {
    ++redirects;
    res.writeHead(301, { 'location': '/new' });
    res.end();
  });
  server.setRoute('/new', (req, res) => { res.end('arrived'); });

  const files = {
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        expect(await page.evaluate(() => fetch('/old').then(r => r.text()))).toBe('arrived');
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  expect(redirects).toBe(1);

  await runInlineTest(files, { workers: 1 });
  expect(redirects).toBe(1); // 301 replayed from cache.
});

test('should not cache loopback traffic', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  server.setRoute('/asset.png', (req, res) => {
    ++hits;
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end('payload');
  });

  const files = {
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)} } };`,
    // Reached over loopback (localhost), which the cache proxy bypasses.
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${server.EMPTY_PAGE}');
        await page.evaluate(${loadImage}, '${server.PREFIX}/asset.png');
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  await runInlineTest(files, { workers: 1 });
  expect(hits).toBe(2); // Loopback is not proxied -> never cached.
  expect(fs.existsSync(path.join(cacheDir, 'index.jsonl'))).toBe(false);
});

test('should respect the match callback disposition', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let pinned = 0;
  let volatileScript = 0;
  let normalScript = 0;
  httpsServer.setRoute('/api/pinned', (req, res) => { ++pinned; res.end('pinned'); });
  httpsServer.setRoute('/volatile.js', (req, res) => {
    ++volatileScript;
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end(';');
  });
  httpsServer.setRoute('/normal.js', (req, res) => {
    ++normalScript;
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end(';');
  });

  const files = {
    'playwright.config.ts': `export default { httpCache: {
      dir: ${JSON.stringify(cacheDir)},
      match: request => {
        if (request.url.includes('/api/pinned'))
          return { disposition: 'cache' };
        if (request.url.includes('/volatile'))
          return { disposition: 'no-cache' };
        return {};
      },
    } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        await page.evaluate(() => fetch('/api/pinned').then(r => r.text()));
        await page.evaluate(${loadScript}, '${remote(httpsServer, true)}/volatile.js');
        await page.evaluate(${loadScript}, '${remote(httpsServer, true)}/normal.js');
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  await runInlineTest(files, { workers: 1 });
  expect(pinned).toBe(1);         // XHR force-cached by the policy.
  expect(volatileScript).toBe(2); // Static resource forced to the network.
  expect(normalScript).toBe(1);   // Default behavior - static, cached.
});

test('should coalesce concurrent identical requests into one upstream fetch', async ({ runInlineTest, server }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let hits = 0;
  server.setRoute('/slow', (req, res) => {
    ++hits;
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('slow payload');
    }, 300);
  });

  const result = await runInlineTest({
    // Force-cache everything so that concurrent fetch() misses coalesce.
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)}, match: () => ({ disposition: 'cache' }) } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('parallel', async ({ page }) => {
        await page.goto('${remote(server)}/empty.html');
        const bodies = await page.evaluate(() => Promise.all(
          Array.from({ length: 8 }, () => fetch('${remote(server)}/slow').then(r => r.text()))));
        expect(bodies).toEqual(Array(8).fill('slow payload'));
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(hits).toBe(1); // 8 concurrent misses coalesced into a single upstream fetch.
});

test('should only cache requests matching the filter', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  let assets = 0;
  let api = 0;
  httpsServer.setRoute('/assets/logo.png', (req, res) => { ++assets; res.end('logo'); });
  httpsServer.setRoute('/api/data.png', (req, res) => { ++api; res.end('data'); });

  const files = {
    'playwright.config.ts': `export default { httpCache: { dir: ${JSON.stringify(cacheDir)}, match: '**/assets/**' } };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/assets/logo.png');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/api/data.png');
      });
    `,
  };

  await runInlineTest(files, { workers: 1 });
  expect(assets).toBe(1);
  expect(api).toBe(1);

  await runInlineTest(files, { workers: 1 });
  expect(assets).toBe(1); // Matched the filter -> served from cache.
  expect(api).toBe(2);    // Not matched -> always hits the network.
});

test('should chain to the configured proxy', async ({ runInlineTest, httpsServer }, testInfo) => {
  const cacheDir = testInfo.outputPath('.network-cache');
  const upstreamProxy = await startUpstreamProxy();
  let hits = 0;
  httpsServer.setRoute('/asset.png', (req, res) => {
    ++hits;
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end('payload');
  });

  const files = {
    'playwright.config.ts': `export default {
      httpCache: { dir: ${JSON.stringify(cacheDir)}, proxy: { server: ${JSON.stringify(upstreamProxy.url)} } },
    };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('load', async ({ page }) => {
        await page.goto('${remote(httpsServer, true)}/empty.html');
        await page.evaluate(${loadImage}, '${remote(httpsServer, true)}/asset.png');
      });
    `,
  };

  try {
    const result1 = await runInlineTest(files, { workers: 1 });
    expect(result1.exitCode).toBe(0);
    expect(hits).toBe(1);
    expect(upstreamProxy.log.length).toBeGreaterThan(0); // Cache misses went through the configured proxy.

    const result2 = await runInlineTest(files, { workers: 1 });
    expect(result2.exitCode).toBe(0);
    expect(hits).toBe(1); // Still served from cache when chaining through a proxy.
  } finally {
    await upstreamProxy.stop();
  }
});

test('should not start the proxy without httpCache', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `export default {};`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('no proxy', async ({ page }) => {
        expect(process.env.PLAYWRIGHT_TEST_CACHE_PROXY).toBeUndefined();
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
