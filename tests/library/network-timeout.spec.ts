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

import http from 'http';
import { browserTest as test, expect } from '../config/browserTest';
import { utils } from '../../packages/playwright-core/lib/coreBundle.js';

test.skip(({ mode }) => mode !== 'default');

test('httpRequest should honor socketTimeout while connecting', async () => {
  // 203.0.113.1 is TEST-NET-3 (RFC 5737), guaranteed to be unroutable, so the
  // TCP connection stalls instead of failing. Node's default agents come with
  // a 5s socket timeout, while `request.setTimeout()` only takes effect after
  // the socket connects - make sure the requested timeout governs from the start.
  const socketTimeout = 8000;
  const start = Date.now();
  const error: Error = await new Promise(resolve => {
    utils.httpRequest({
      url: 'http://203.0.113.1/index.html',
      socketTimeout,
    }, () => resolve(new Error('unexpected response')), resolve);
  });
  const elapsed = Date.now() - start;
  if (!error.message.includes('timed out after')) {
    // Some networks actively refuse TEST-NET addresses instead of blackholing them.
    test.skip(true, `environment does not stall connections to TEST-NET: ${error.message}`);
    return;
  }
  expect(error.message).toContain(`timed out after ${socketTimeout}ms`);
  expect(elapsed).toBeGreaterThanOrEqual(socketTimeout - 1000);
});

test('httpRequest should honor socketTimeout for stalled responses', async () => {
  const server = http.createServer(() => {});
  await new Promise<void>(f => server.listen(0, '127.0.0.1', () => f()));
  const port = (server.address() as import('node:net').AddressInfo).port;
  const socketTimeout = 1500;
  const start = Date.now();
  try {
    const error: Error = await new Promise(resolve => {
      utils.httpRequest({
        url: `http://127.0.0.1:${port}/index.html`,
        socketTimeout,
      }, () => resolve(new Error('unexpected response')), resolve);
    });
    const elapsed = Date.now() - start;
    expect(error.message).toContain(`timed out after ${socketTimeout}ms`);
    expect(elapsed).toBeGreaterThanOrEqual(socketTimeout - 500);
    expect(elapsed).toBeLessThan(socketTimeout * 3);
  } finally {
    server.close();
  }
});
