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

import type { LookupAddress } from 'dns';
import { contextTest as it, expect } from '../config/browserTest';

it.skip(({ mode }) => mode !== 'default');

const __testHookLookup = (hostname: string): LookupAddress[] => {
  interceptedHostnameLookup = hostname;
  if (hostname === 'localhost') {
    return [
      // First two do are not served (at least on macOS).
      { address: '::2', family: 6 },
      { address: '127.0.0.2', family: 4 },
      { address: '::1', family: 6 },
      { address: '127.0.0.1', family: 4 }];
  } else {
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }
};

let interceptedHostnameLookup: string | undefined;

it.beforeEach(({ server }) => {
  interceptedHostnameLookup = undefined;
  // Force a new connection every time, so that we can intercept the hostname lookup.
  server.setExtraHeaders('/simple.json', {
    'Connection': 'close',
  });
});

it('get should work', async ({ context, server }) => {
  const response = await context.request.get(server.PREFIX + '/simple.json', { __testHookLookup } as any);
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  await expect(response).toBeOK();
  expect(interceptedHostnameLookup).toBe('localhost');
});

it('get should work on request fixture', async ({ request, server }) => {
  const response = await request.get(server.PREFIX + '/simple.json', { __testHookLookup } as any);
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  await expect(response).toBeOK();
  expect(interceptedHostnameLookup).toBe('localhost');
});

it('https post should work with ignoreHTTPSErrors option', async ({ context, httpsServer }) => {
  const response = await context.request.post(httpsServer.EMPTY_PAGE,
    { ignoreHTTPSErrors: true, __testHookLookup } as any);
  expect(response.status()).toBe(200);
  expect(interceptedHostnameLookup).toBe('localhost');
});


it('should work with ip6 and port as the host', async ({ request, server }) => {
  it.skip(!!process.env.INSIDE_DOCKER, 'docker does not support IPv6 by default');
  const response = await request.get(`http://[::1]:${server.PORT}/simple.json`);
  expect(response.url()).toBe(`http://[::1]:${server.PORT}/simple.json`);
  await expect(response).toBeOK();
});
