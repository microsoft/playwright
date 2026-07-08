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

import { test as base, expect } from '@playwright/test';
import http from 'http';
import https from 'https';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { generateSelfSignedCertificate } from '@utils/crypto';
import { CacheProxy } from '../../../packages/playwright/src/plugins/cacheProxy/server';
import { ResponseCache } from '../../../packages/playwright/src/plugins/cacheProxy/cache';
import type { CacheEntry } from '../../../packages/playwright/src/plugins/cacheProxy/server';
import type { ProxySettings } from '@utils/network';

// A non-loopback name that resolves to 127.0.0.1, so the proxy's loopback
// bypass does not skip our local origin.
const HOST = 'fake-localhost-127-0-0-1.nip.io';

type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;
type Origin = {
  port: number;
  url: (p: string) => string;
  loopbackUrl: (p: string) => string;
  wsUrl: (p: string) => string;
  setRoute: (p: string, h: RouteHandler) => void;
  hits: (p: string) => number;
  onWebSocket: (h: (ws: WebSocket) => void) => void;
  close: () => Promise<void>;
};

async function startOrigin(tls?: https.ServerOptions): Promise<Origin> {
  const hits = new Map<string, number>();
  const routes = new Map<string, RouteHandler>();
  const handler: RouteHandler = (req, res) => {
    const p = new URL(req.url || '/', 'http://x').pathname;
    hits.set(p, (hits.get(p) || 0) + 1);
    const route = routes.get(p);
    if (route) {
      route(req, res);
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  };
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  const wss = new WebSocketServer({ server });
  let wsHandler: ((ws: WebSocket) => void) | undefined;
  wss.on('connection', ws => wsHandler?.(ws));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  const scheme = tls ? 'https' : 'http';
  return {
    port,
    url: p => `${scheme}://${HOST}:${port}${p}`,
    loopbackUrl: p => `${scheme}://127.0.0.1:${port}${p}`,
    wsUrl: p => `${tls ? 'wss' : 'ws'}://${HOST}:${port}${p}`,
    setRoute: (p, h) => routes.set(p, h),
    hits: p => hits.get(p) || 0,
    onWebSocket: h => { wsHandler = h; },
    close: () => new Promise<void>(resolve => {
      for (const client of wss.clients)
        client.terminate();
      wss.close();
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

type Result = { status: number, headers: http.IncomingHttpHeaders, body: string };

// Drive a forward-proxy GET (absolute request target) through the proxy and
// buffer the whole response.
function drive(proxyAddress: string, targetUrl: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Result> {
  const proxy = new URL(proxyAddress);
  const target = new URL(targetUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: proxy.hostname, port: Number(proxy.port), method, path: targetUrl, headers: { host: target.host, ...headers } }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// Resolve as soon as the first body chunk arrives, without waiting for the
// response to end - used to prove streaming responses are not buffered.
function driveFirstChunk(proxyAddress: string, targetUrl: string, headers: Record<string, string> = {}): Promise<{ status: number, chunk: string }> {
  const proxy = new URL(proxyAddress);
  const target = new URL(targetUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: proxy.hostname, port: Number(proxy.port), path: targetUrl, headers: { host: target.host, ...headers } }, res => {
      res.once('data', chunk => {
        resolve({ status: res.statusCode || 0, chunk: chunk.toString() });
        req.destroy();
      });
      res.on('error', () => {});
    });
    req.on('error', reject);
    req.end();
  });
}

// Drive an https (MITM) GET through the proxy via CONNECT.
function driveTls(proxyAddress: string, targetUrl: string, headers: Record<string, string> = {}): Promise<Result> {
  const agent = new HttpsProxyAgent(proxyAddress);
  return new Promise((resolve, reject) => {
    const req = https.request(targetUrl, { agent, rejectUnauthorized: false, headers } as https.RequestOptions, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function wsEcho(proxyAddress: string, wsUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { agent: new HttpsProxyAgent(proxyAddress), rejectUnauthorized: false } as any);
    ws.on('open', () => ws.send('ping'));
    ws.on('message', data => { resolve(data.toString()); ws.close(); });
    ws.on('error', reject);
  });
}

const response = (body: string, headers: [string, string][] = []): { status: number, statusText: string, headers: [string, string][], body: Buffer } =>
  ({ status: 200, statusText: 'OK', headers, body: Buffer.from(body) });

type Fixtures = {
  origin: Origin;
  httpsOrigin: Origin;
  cacheDir: () => string;
  startProxy: (entry: CacheEntry, upstream?: ProxySettings) => Promise<string>;
};

const it = base.extend<Fixtures>({
  origin: async ({}, use) => {
    const origin = await startOrigin();
    await use(origin);
    await origin.close();
  },
  httpsOrigin: async ({}, use) => {
    const origin = await startOrigin(generateSelfSignedCertificate());
    await use(origin);
    await origin.close();
  },
  cacheDir: async ({}, use, testInfo) => {
    let index = 0;
    await use(() => testInfo.outputPath('cache-' + (index++)));
  },
  startProxy: async ({}, use) => {
    const started: CacheProxy[] = [];
    await use(async (entry, upstream) => {
      const proxy = new CacheProxy(entry, upstream);
      const address = await proxy.start();
      started.push(proxy);
      return address;
    });
    await Promise.all(started.map(proxy => proxy.stop()));
  },
});

// Convenience: a single-cache proxy over a fresh directory.
async function cachingProxy(startProxy: Fixtures['startProxy'], cacheDir: Fixtures['cacheDir'], match: CacheEntry['match'] = undefined, upstream?: ProxySettings) {
  const dir = cacheDir();
  const cache = new ResponseCache(dir);
  const address = await startProxy({ cache, match }, upstream);
  return { address, dir, cache };
}

it.describe('ResponseCache', () => {
  it('key is deterministic and identity-sensitive', () => {
    const a = ResponseCache.key('GET', 'http://x/a');
    expect(ResponseCache.key('GET', 'http://x/a')).toBe(a);
    expect(ResponseCache.key('GET', 'http://x/a', '')).toBe(a);
    expect(ResponseCache.key('GET', 'http://x/b')).not.toBe(a);
    expect(ResponseCache.key('GET', 'http://x/a', 'alice')).not.toBe(ResponseCache.key('GET', 'http://x/a', 'bob'));
  });

  it('roundtrips status, headers and body', async ({ cacheDir }) => {
    const cache = new ResponseCache(cacheDir());
    await cache.load();
    const key = ResponseCache.key('GET', 'http://x/a');
    expect(await cache.get(key, {})).toBeUndefined();
    await cache.set(key, 'http://x/a', {}, response('hello', [['content-type', 'text/plain']]));
    const got = await cache.get(key, {});
    expect(got!.status).toBe(200);
    expect(got!.headers).toEqual([['content-type', 'text/plain']]);
    expect(got!.body.toString()).toBe('hello');
  });

  it('stores small bodies inline and large bodies as blobs', async ({ cacheDir }) => {
    const dir = cacheDir();
    const cache = new ResponseCache(dir);
    await cache.load();
    await cache.set(ResponseCache.key('GET', 'http://x/small'), 'http://x/small', {}, response('tiny'));
    const big = Buffer.alloc(9000, 0x61);
    await cache.set(ResponseCache.key('GET', 'http://x/big'), 'http://x/big', {}, { status: 200, statusText: 'OK', headers: [], body: big });
    await cache.flush();
    const index = fs.readFileSync(path.join(dir, 'index.jsonl'), 'utf8');
    expect(index).toContain('"c":'); // inline
    expect(index).toContain('"f":'); // blob reference
    expect(fs.existsSync(path.join(dir, 'blobs'))).toBe(true);
    expect((await cache.get(ResponseCache.key('GET', 'http://x/big'), {}))!.body.length).toBe(9000);
  });

  it('persists across cache instances', async ({ cacheDir }) => {
    const dir = cacheDir();
    const key = ResponseCache.key('GET', 'http://x/a');
    const first = new ResponseCache(dir);
    await first.load();
    await first.set(key, 'http://x/a', {}, response('persisted'));
    await first.flush();
    const second = new ResponseCache(dir);
    await second.load();
    expect((await second.get(key, {}))!.body.toString()).toBe('persisted');
  });

  it('discards the cache on version mismatch', async ({ cacheDir }) => {
    const dir = cacheDir();
    const key = ResponseCache.key('GET', 'http://x/a');
    const first = new ResponseCache(dir);
    await first.load();
    await first.set(key, 'http://x/a', {}, response('v'));
    await first.flush();
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ version: 999 }));
    const second = new ResponseCache(dir);
    await second.load();
    expect(await second.get(key, {})).toBeUndefined();
  });

  it('load is a no-op without an index', async ({ cacheDir }) => {
    const cache = new ResponseCache(cacheDir());
    await cache.load();
    expect(await cache.get(ResponseCache.key('GET', 'http://x/a'), {})).toBeUndefined();
  });

  it('keys variants by their vary fields', async ({ cacheDir }) => {
    const cache = new ResponseCache(cacheDir());
    await cache.load();
    const key = ResponseCache.key('GET', 'http://x/v');
    await cache.set(key, 'http://x/v', { 'x-foo': 'a' }, response('A', [['vary', 'x-foo']]));
    await cache.set(key, 'http://x/v', { 'x-foo': 'b' }, response('B', [['vary', 'x-foo']]));
    expect((await cache.get(key, { 'x-foo': 'a' }))!.body.toString()).toBe('A');
    expect((await cache.get(key, { 'x-foo': 'b' }))!.body.toString()).toBe('B');
    expect(await cache.get(key, { 'x-foo': 'c' })).toBeUndefined();
  });

  it('dedups identical variants', async ({ cacheDir }) => {
    const dir = cacheDir();
    const cache = new ResponseCache(dir);
    await cache.load();
    const key = ResponseCache.key('GET', 'http://x/a');
    await cache.set(key, 'http://x/a', {}, response('one'));
    await cache.set(key, 'http://x/a', {}, response('two'));
    await cache.flush();
    const lines = fs.readFileSync(path.join(dir, 'index.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect((await cache.get(key, {}))!.body.toString()).toBe('one');
  });
});

it.describe('default caching', () => {
  it('caches a static subresource and replays it', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/img', (req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end('pixels'); });
    const { address, dir, cache } = await cachingProxy(startProxy, cacheDir);
    const first = await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
    expect(first.status).toBe(200);
    expect(first.body).toBe('pixels');
    expect(origin.hits('/img')).toBe(1);
    const second = await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
    expect(second.body).toBe('pixels');
    expect(second.headers['content-type']).toBe('image/png');
    expect(origin.hits('/img')).toBe(1);
    await cache.flush();
    expect(fs.existsSync(path.join(dir, 'index.jsonl'))).toBe(true);
  });

  it('does not cache requests without fetch metadata', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/x', (req, res) => res.end('body'));
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/x'));
    await drive(address, origin.url('/x'));
    expect(origin.hits('/x')).toBe(2);
  });

  it('does not cache xhr/fetch (empty destination)', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/api', (req, res) => res.end('data'));
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/api'), { 'sec-fetch-dest': 'empty' });
    await drive(address, origin.url('/api'), { 'sec-fetch-dest': 'empty' });
    expect(origin.hits('/api')).toBe(2);
  });

  for (const directive of ['no-store', 'private']) {
    it(`does not cache Cache-Control: ${directive}`, async ({ origin, startProxy, cacheDir }) => {
      origin.setRoute('/r', (req, res) => { res.writeHead(200, { 'cache-control': directive }); res.end('x'); });
      const { address } = await cachingProxy(startProxy, cacheDir);
      await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image' });
      await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image' });
      expect(origin.hits('/r')).toBe(2);
    });
  }

  it('does not cache responses with Set-Cookie', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/r', (req, res) => { res.writeHead(200, { 'set-cookie': 'sid=1' }); res.end('x'); });
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image' });
    await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image' });
    expect(origin.hits('/r')).toBe(2);
  });

  for (const vary of ['cookie', 'authorization', '*']) {
    it(`does not cache Vary: ${vary}`, async ({ origin, startProxy, cacheDir }) => {
      origin.setRoute('/r', (req, res) => { res.writeHead(200, { 'vary': vary }); res.end('x'); });
      const { address } = await cachingProxy(startProxy, cacheDir);
      await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image' });
      await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image' });
      expect(origin.hits('/r')).toBe(2);
    });
  }

  it('keys cached variants by Vary', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/v', (req, res) => { res.writeHead(200, { 'vary': 'x-variant', 'sec-fetch-dest': 'image' }); res.end('variant:' + (req.headers['x-variant'] || '')); });
    const { address } = await cachingProxy(startProxy, cacheDir);
    expect((await drive(address, origin.url('/v'), { 'sec-fetch-dest': 'image', 'x-variant': 'a' })).body).toBe('variant:a');
    expect((await drive(address, origin.url('/v'), { 'sec-fetch-dest': 'image', 'x-variant': 'b' })).body).toBe('variant:b');
    expect(origin.hits('/v')).toBe(2);
    expect((await drive(address, origin.url('/v'), { 'sec-fetch-dest': 'image', 'x-variant': 'a' })).body).toBe('variant:a');
    expect(origin.hits('/v')).toBe(2);
  });

  for (const status of [301, 308]) {
    it(`caches ${status} redirects`, async ({ origin, startProxy, cacheDir }) => {
      origin.setRoute('/old', (req, res) => { res.writeHead(status, { location: '/new' }); res.end(); });
      const { address } = await cachingProxy(startProxy, cacheDir);
      expect((await drive(address, origin.url('/old'))).status).toBe(status);
      expect((await drive(address, origin.url('/old'))).status).toBe(status);
      expect(origin.hits('/old')).toBe(1);
    });
  }

  it('does not cache 302 temporary redirects', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/old', (req, res) => { res.writeHead(302, { location: '/new' }); res.end(); });
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/old'));
    await drive(address, origin.url('/old'));
    expect(origin.hits('/old')).toBe(2);
  });

  it('does not cache non-GET requests', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/p', (req, res) => res.end('x'));
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/p'), { 'sec-fetch-dest': 'image' }, 'POST');
    await drive(address, origin.url('/p'), { 'sec-fetch-dest': 'image' }, 'POST');
    expect(origin.hits('/p')).toBe(2);
  });

  it('honors a request-side Cache-Control: no-store', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/r', (req, res) => { res.writeHead(200); res.end('x'); });
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image', 'cache-control': 'no-store' });
    await drive(address, origin.url('/r'), { 'sec-fetch-dest': 'image', 'cache-control': 'no-store' });
    expect(origin.hits('/r')).toBe(2);
  });
});

it.describe('match callback', () => {
  it('restricts caching to a URL glob', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/assets/a', (req, res) => res.end('a'));
    origin.setRoute('/api/b', (req, res) => res.end('b'));
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: '**/assets/**' });
    await drive(address, origin.url('/assets/a'), { 'sec-fetch-dest': 'image' });
    await drive(address, origin.url('/assets/a'), { 'sec-fetch-dest': 'image' });
    await drive(address, origin.url('/api/b'), { 'sec-fetch-dest': 'image' });
    await drive(address, origin.url('/api/b'), { 'sec-fetch-dest': 'image' });
    expect(origin.hits('/assets/a')).toBe(1);
    expect(origin.hits('/api/b')).toBe(2);
  });

  it("force-caches with disposition 'cache' regardless of metadata", async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/api', (req, res) => res.end('data'));
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: () => ({ disposition: 'cache' }) });
    await drive(address, origin.url('/api'));
    await drive(address, origin.url('/api'));
    expect(origin.hits('/api')).toBe(1);
  });

  it("bypasses the cache with disposition 'no-cache'", async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/img', (req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end('x'); });
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: () => ({ disposition: 'no-cache' }) });
    await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
    await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
    expect(origin.hits('/img')).toBe(2);
  });

  it('partitions the cache by identity', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/me', (req, res) => res.end('user:' + (req.headers['x-user'] || 'guest')));
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: request => ({ disposition: 'cache', identity: request.headers.get('x-user') }) });
    expect((await drive(address, origin.url('/me'), { 'x-user': 'alice' })).body).toBe('user:alice');
    expect((await drive(address, origin.url('/me'), { 'x-user': 'bob' })).body).toBe('user:bob');
    expect(origin.hits('/me')).toBe(2);
    // Alice's own entry, never bob's.
    expect((await drive(address, origin.url('/me'), { 'x-user': 'alice' })).body).toBe('user:alice');
    expect((await drive(address, origin.url('/me'))).body).toBe('user:guest');
    expect(origin.hits('/me')).toBe(3);
  });

  it('invokes the callback once per request with a WHATWG Request', async ({ origin, startProxy, cacheDir }) => {
    const seen: { url: string, method: string, dest: string | null, host: string | null, cookie: string | null }[] = [];
    origin.setRoute('/probe', (req, res) => res.end('x'));
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: request => {
      expect(request).toBeInstanceOf(Request);
      seen.push({
        url: request.url,
        method: request.method,
        dest: request.headers.get('sec-fetch-dest'),
        host: request.headers.get('host'),
        cookie: request.headers.get('cookie'),
      });
      return {};
    } });
    await drive(address, origin.url('/probe'), { 'sec-fetch-dest': 'image', 'cookie': 'sid=1' });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      url: origin.url('/probe'),
      method: 'GET',
      dest: 'image',
      host: `${HOST}:${origin.port}`,
      cookie: 'sid=1', // Node's Request keeps "forbidden" headers.
    });
  });

  it('passes through a URL that does not match the glob', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/api/b', (req, res) => res.end('b'));
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: '**/assets/**' });
    await drive(address, origin.url('/api/b'), { 'sec-fetch-dest': 'image' });
    await drive(address, origin.url('/api/b'), { 'sec-fetch-dest': 'image' });
    expect(origin.hits('/api/b')).toBe(2);
  });
});

it.describe('streaming and coalescing', () => {
  it('streams a non-storable response without buffering', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/stream', (req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.write('first-chunk'); });
    const { address } = await cachingProxy(startProxy, cacheDir);
    const { chunk } = await driveFirstChunk(address, origin.url('/stream'));
    expect(chunk).toBe('first-chunk');
  });

  it('coalesces concurrent identical misses into one upstream fetch', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/slow', (req, res) => setTimeout(() => res.end('slow'), 200));
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: () => ({ disposition: 'cache' }) });
    const results = await Promise.all(Array.from({ length: 8 }, () => drive(address, origin.url('/slow'))));
    expect(results.map(r => r.body)).toEqual(Array(8).fill('slow'));
    expect(origin.hits('/slow')).toBe(1);
  });

  it('does not coalesce non-storable responses', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/slow', (req, res) => setTimeout(() => res.end('slow'), 200));
    const { address } = await cachingProxy(startProxy, cacheDir);
    const results = await Promise.all(Array.from({ length: 5 }, () => drive(address, origin.url('/slow'))));
    expect(results.map(r => r.body)).toEqual(Array(5).fill('slow'));
    expect(origin.hits('/slow')).toBe(5);
  });
});

it.describe('websockets', () => {
  it('tunnels a plaintext ws:// connection', async ({ origin, startProxy, cacheDir }) => {
    origin.onWebSocket(ws => ws.on('message', () => ws.send('pong')));
    const { address } = await cachingProxy(startProxy, cacheDir);
    expect(await wsEcho(address, origin.wsUrl('/ws'))).toBe('pong');
  });

  it('tunnels a secure wss:// connection through MITM', async ({ httpsOrigin, startProxy, cacheDir }) => {
    httpsOrigin.onWebSocket(ws => ws.on('message', () => ws.send('pong')));
    const { address } = await cachingProxy(startProxy, cacheDir);
    expect(await wsEcho(address, httpsOrigin.wsUrl('/ws'))).toBe('pong');
  });
});

it.describe('https MITM', () => {
  it('caches https responses via TLS termination', async ({ httpsOrigin, startProxy, cacheDir }) => {
    httpsOrigin.setRoute('/img', (req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end('secure'); });
    const { address } = await cachingProxy(startProxy, cacheDir);
    expect((await driveTls(address, httpsOrigin.url('/img'), { 'sec-fetch-dest': 'image' })).body).toBe('secure');
    expect((await driveTls(address, httpsOrigin.url('/img'), { 'sec-fetch-dest': 'image' })).body).toBe('secure');
    expect(httpsOrigin.hits('/img')).toBe(1);
  });
});

it.describe('errors and edge cases', () => {
  it('returns 502 when the upstream is unreachable', async ({ origin, startProxy, cacheDir }) => {
    const url = origin.url('/gone');
    await origin.close();
    const { address } = await cachingProxy(startProxy, cacheDir);
    expect((await drive(address, url, { 'sec-fetch-dest': 'image' })).status).toBe(502);
  });

  it('survives a throwing match callback', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/ok', (req, res) => res.end('ok'));
    let boom = true;
    const dir = cacheDir();
    const address = await startProxy({ cache: new ResponseCache(dir), match: () => {
      if (boom)
        throw new Error('boom');
      return {};
    } });
    expect((await drive(address, origin.url('/ok'))).status).toBe(502);
    boom = false;
    expect((await drive(address, origin.url('/ok'))).body).toBe('ok');
  });

  it('passes loopback traffic through without caching', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/img', (req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end('x'); });
    const { address, dir } = await cachingProxy(startProxy, cacheDir);
    // Addressed over loopback (127.0.0.1) instead of the resolvable name.
    expect((await drive(address, origin.loopbackUrl('/img'), { 'sec-fetch-dest': 'image' })).body).toBe('x');
    await drive(address, origin.loopbackUrl('/img'), { 'sec-fetch-dest': 'image' });
    expect(origin.hits('/img')).toBe(2);
    expect(fs.existsSync(path.join(dir, 'index.jsonl'))).toBe(false);
  });

  it('preserves response headers and body verbatim on replay', async ({ origin, startProxy, cacheDir }) => {
    origin.setRoute('/img', (req, res) => {
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'x-custom': 'kept', 'content-encoding': 'identity' });
      res.end('<svg/>');
    });
    const { address } = await cachingProxy(startProxy, cacheDir);
    await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
    const replayed = await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
    expect(origin.hits('/img')).toBe(1);
    expect(replayed.headers['content-type']).toBe('image/svg+xml');
    expect(replayed.headers['x-custom']).toBe('kept');
    expect(replayed.body).toBe('<svg/>');
  });
});

it.describe('upstream proxy chaining', () => {
  it('fetches misses through the configured upstream proxy', async ({ origin, startProxy, cacheDir }) => {
    const tunnelled: string[] = [];
    const upstream = http.createServer((req, res) => { res.writeHead(502); res.end(); });
    upstream.on('connect', (req, socket, head) => {
      tunnelled.push(req.url!);
      const [host, port] = req.url!.split(':');
      const target = net.connect({ host, port: Number(port), family: 4 }, () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length)
          target.write(head);
        socket.pipe(target);
        target.pipe(socket);
      });
      target.on('error', () => socket.destroy());
      socket.on('error', () => target.destroy());
    });
    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamUrl = `http://127.0.0.1:${(upstream.address() as net.AddressInfo).port}`;

    origin.setRoute('/img', (req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end('x'); });
    try {
      const { address } = await cachingProxy(startProxy, cacheDir, undefined, { server: upstreamUrl });
      expect((await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' })).body).toBe('x');
      expect(tunnelled.length).toBeGreaterThan(0);
      await drive(address, origin.url('/img'), { 'sec-fetch-dest': 'image' });
      expect(origin.hits('/img')).toBe(1); // second is a cache hit, no new tunnel
    } finally {
      await new Promise<void>(resolve => upstream.close(() => resolve()));
    }
  });
});
