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

import { contextTest as it, expect } from '../config/browserTest';

it('should remove cookies by name', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/',
  },
  {
    name: 'cookie2',
    value: '2',
    domain: 'www.example.com',
    path: '/',
  }
  ]);
  await page.goto('https://www.example.com');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2');
  await context.removeCookies({ name: 'cookie1' });
  expect(await page.evaluate('document.cookie')).toBe('cookie2=2');
});

it('should remove cookies by domain', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/',
  },
  {
    name: 'cookie2',
    value: '2',
    domain: 'www.example.org',
    path: '/',
  }
  ]);
  await page.goto('https://www.example.com');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
  await page.goto('https://www.example.org');
  expect(await page.evaluate('document.cookie')).toBe('cookie2=2');
  await context.removeCookies({ domain: 'www.example.org' });
  expect(await page.evaluate('document.cookie')).toBe('');
  await page.goto('https://www.example.com');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
});

it('should remove cookies by path', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/api/v1',
  },
  {
    name: 'cookie2',
    value: '2',
    domain: 'www.example.com',
    path: '/api/v2',
  },
  {
    name: 'cookie3',
    value: '3',
    domain: 'www.example.com',
    path: '/',
  }
  ]);
  await page.goto('https://www.example.com/api/v1');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie3=3');
  await context.removeCookies({ path: '/api/v1' });
  expect(await page.evaluate('document.cookie')).toBe('cookie3=3');
  await page.goto('https://www.example.com/api/v2');
  expect(await page.evaluate('document.cookie')).toBe('cookie2=2; cookie3=3');
  await page.goto('https://www.example.com/');
  expect(await page.evaluate('document.cookie')).toBe('cookie3=3');
});

it('should remove cookies by name and domain', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/',
  },
  {
    name: 'cookie1',
    value: '1',
    domain: 'www.example.org',
    path: '/',
  }
  ]);
  await page.goto('https://www.example.com');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
  await context.removeCookies({ name: 'cookie1', domain: 'www.example.com' });
  expect(await page.evaluate('document.cookie')).toBe('');
  await page.goto('https://www.example.org');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
});

it('should remove cookies by name and path', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/api/v1',
  },
  {
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/api/v2',
  },
  {
    name: 'cookie3',
    value: '3',
    domain: 'www.example.com',
    path: '/',
  }
  ]);
  await page.goto('https://www.example.com/api/v1');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie3=3');
  await context.removeCookies({ name: 'cookie1', path: '/api/v1' });
  expect(await page.evaluate('document.cookie')).toBe('cookie3=3');
  await page.goto('https://www.example.com/api/v2');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie3=3');
  await page.goto('https://www.example.com/');
  expect(await page.evaluate('document.cookie')).toBe('cookie3=3');
});

it('should remove cookies by domain and path', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/api/v1',
  },
  {
    name: 'cookie2',
    value: '2',
    domain: 'www.example.com',
    path: '/api/v2',
  },
  {
    name: 'cookie3',
    value: '3',
    domain: 'www.example.org',
    path: '/api/v1',
  },
  {
    name: 'cookie4',
    value: '4',
    domain: 'www.example.org',
    path: '/api/v2',
  }
  ]);
  await page.goto('https://www.example.com/api/v1');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
  await context.removeCookies({ domain: 'www.example.com', path: '/api/v1' });
  expect(await page.evaluate('document.cookie')).toBe('');
  await page.goto('https://www.example.com/api/v2');
  expect(await page.evaluate('document.cookie')).toBe('cookie2=2');
  await page.goto('https://www.example.org/api/v2');
  expect(await page.evaluate('document.cookie')).toBe('cookie4=4');
});

it('should remove cookies by name, domain and path', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/api/v1',
  },
  {
    name: 'cookie2',
    value: '2',
    domain: 'www.example.com',
    path: '/api/v2',
  },
  {
    name: 'cookie1',
    value: '1',
    domain: 'www.example.org',
    path: '/api/v1',
  },
  ]);
  await page.goto('https://www.example.com/api/v1');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
  await context.removeCookies({ name: 'cookie1', domain: 'www.example.com', path: '/api/v1' });
  expect(await page.evaluate('document.cookie')).toBe('');
  await page.goto('https://www.example.com/api/v2');
  expect(await page.evaluate('document.cookie')).toBe('cookie2=2');
  await page.goto('https://www.example.org/api/v1');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
});

it('should throw if empty object is passed', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'cookie1',
    value: '1',
    domain: 'www.example.com',
    path: '/',
  },
  {
    name: 'cookie2',
    value: '2',
    domain: 'www.example.com',
    path: '/',
  },
  ]);
  await page.goto('https://www.example.com/');
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2');
  const error = await context.removeCookies({ }).catch(e => e);
  expect(error.message).toContain(`Either name, domain or path are required`);
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2');
});
