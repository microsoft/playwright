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

import fs from 'fs';
import path from 'path';

import { contextTest as it, expect } from '../config/browserTest';

it('should record and replay a response from cache', async ({ contextFactory, server }, testInfo) => {
  const dir = testInfo.outputPath('cache');
  let hits = 0;
  server.setRoute('/data', (req, res) => {
    ++hits;
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('hello from server');
  });

  // First run: records to disk.
  {
    const context = await contextFactory();
    await context.routeFromCache({ dir });
    const page = await context.newPage();
    const response = await page.goto(server.PREFIX + '/data');
    expect(await response.text()).toBe('hello from server');
    expect(hits).toBe(1);
    await context.close();
  }

  // Second run: replays from disk without hitting the server.
  {
    const context = await contextFactory();
    await context.routeFromCache({ dir });
    const page = await context.newPage();
    const response = await page.goto(server.PREFIX + '/data');
    expect(await response.text()).toBe('hello from server');
    expect(hits).toBe(1); // No new server hit.
    await context.close();
  }
});

it('should inline small bodies and blob large bodies', async ({ contextFactory, server }, testInfo) => {
  const dir = testInfo.outputPath('cache');
  const large = 'x'.repeat(16 * 1024);
  server.setRoute('/small', (req, res) => res.end('tiny'));
  server.setRoute('/large', (req, res) => res.end(large));

  const context = await contextFactory();
  await context.routeFromCache({ dir });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(async prefix => {
    await fetch(prefix + '/small').then(r => r.text());
    await fetch(prefix + '/large').then(r => r.text());
  }, server.PREFIX);
  await context.close();

  const index = fs.readFileSync(path.join(dir, 'index.ndjson'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const small = index.find(r => r.u.endsWith('/small'));
  const largeRecord = index.find(r => r.u.endsWith('/large'));
  expect(small.c).toBeTruthy();
  expect(largeRecord.f).toBeTruthy();

  // The large body is stored as a content-addressed blob, the small one is not.
  const blob = path.join(dir, 'blobs', largeRecord.f.slice(0, 2), largeRecord.f);
  expect(fs.readFileSync(blob, 'utf8')).toBe(large);
  expect(fs.existsSync(path.join(dir, 'meta.json'))).toBe(true);
});

it('should replay gzip-encoded responses', async ({ contextFactory, server }, testInfo) => {
  const dir = testInfo.outputPath('cache');
  let hits = 0;
  server.setRoute('/gzipped', (req, res) => { ++hits; res.end('this body is gzipped on the wire'); });
  server.enableGzip('/gzipped');

  // Record.
  {
    const context = await contextFactory();
    await context.routeFromCache({ dir });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const body = await page.evaluate(prefix => fetch(prefix + '/gzipped').then(r => r.text()), server.PREFIX);
    expect(body).toBe('this body is gzipped on the wire');
    expect(hits).toBe(1);
    await context.close();
  }

  // Replay from cache: the decoded body must still be readable (content-encoding stripped), no new server hit.
  {
    const context = await contextFactory();
    await context.routeFromCache({ dir });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const body = await page.evaluate(prefix => fetch(prefix + '/gzipped').then(r => r.text()), server.PREFIX);
    expect(body).toBe('this body is gzipped on the wire');
    expect(hits).toBe(1); // Served from cache, no new server hit.
    await context.close();
  }
});

it('should only cache GET requests by default', async ({ contextFactory, server }, testInfo) => {
  const dir = testInfo.outputPath('cache');
  let posts = 0;
  server.setRoute('/post', (req, res) => {
    ++posts;
    res.end('posted');
  });

  const context = await contextFactory();
  await context.routeFromCache({ dir });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(prefix => fetch(prefix + '/post', { method: 'POST', body: 'x' }).then(r => r.text()), server.PREFIX);
  await page.evaluate(prefix => fetch(prefix + '/post', { method: 'POST', body: 'x' }).then(r => r.text()), server.PREFIX);
  await context.close();
  expect(posts).toBe(2); // Both POSTs hit the network, neither cached.
  const index = fs.readFileSync(path.join(dir, 'index.ndjson'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  expect(index.some(r => r.u.endsWith('/post'))).toBe(false); // Only GET requests are cached.
});

it('should stop caching after the returned disposable is disposed', async ({ contextFactory, server }, testInfo) => {
  const dir = testInfo.outputPath('cache');
  let hits = 0;
  server.setRoute('/data', (req, res) => {
    ++hits;
    res.end('payload');
  });

  const context = await contextFactory();
  const cache = await context.routeFromCache({ dir });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.evaluate(prefix => fetch(prefix + '/data').then(r => r.text()), server.PREFIX);
  await page.evaluate(prefix => fetch(prefix + '/data').then(r => r.text()), server.PREFIX);
  expect(hits).toBe(1); // Second request served from cache.

  await cache.dispose();
  await page.evaluate(prefix => fetch(prefix + '/data').then(r => r.text()), server.PREFIX);
  expect(hits).toBe(2); // After dispose, requests go to the network again.

  await context.close();
});

it('should respect the match pattern', async ({ contextFactory, server }, testInfo) => {
  const dir = testInfo.outputPath('cache');
  let a = 0;
  let b = 0;
  server.setRoute('/a', (req, res) => { ++a; res.end('a'); });
  server.setRoute('/b', (req, res) => { ++b; res.end('b'); });

  const record = async () => {
    const context = await contextFactory();
    await context.routeFromCache({ dir, match: '**/a' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(async prefix => {
      await fetch(prefix + '/a').then(r => r.text());
      await fetch(prefix + '/b').then(r => r.text());
    }, server.PREFIX);
    await context.close();
  };

  await record();
  expect(a).toBe(1);
  expect(b).toBe(1);
  await record();
  expect(a).toBe(1); // /a served from cache on the second run.
  expect(b).toBe(2); // /b never cached, hits the network again.
});
