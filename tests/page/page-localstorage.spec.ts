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

import { test as it, expect } from './pageTest';

it('localStorage.items returns empty array on fresh origin', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  expect(await page.localStorage.items()).toEqual([]);
});

it('localStorage.getItem returns null for missing key', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  expect(await page.localStorage.getItem('absent')).toBeNull();
});

it('localStorage.setItem persists and surfaces in items()/getItem()', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.localStorage.setItem('alpha', '1');
  await page.localStorage.setItem('beta', '2');

  expect(new Set(await page.localStorage.items())).toEqual(new Set([
    { name: 'alpha', value: '1' },
    { name: 'beta', value: '2' },
  ]));
  expect(await page.localStorage.getItem('alpha')).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('alpha'))).toBe('1');
});

it('localStorage.setItem overwrites existing value', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.localStorage.setItem('k', 'first');
  await page.localStorage.setItem('k', 'second');
  expect(await page.localStorage.getItem('k')).toBe('second');
});

it('localStorage.removeItem removes a single item', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.localStorage.setItem('a', '1');
  await page.localStorage.setItem('b', '2');

  await page.localStorage.removeItem('a');
  expect(await page.localStorage.items()).toEqual([{ name: 'b', value: '2' }]);
});

it('localStorage.clear empties storage', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.localStorage.setItem('a', '1');
  await page.localStorage.setItem('b', '2');

  await page.localStorage.clear();
  expect(await page.localStorage.items()).toEqual([]);
});

it('sessionStorage round-trip', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  expect(await page.sessionStorage.items()).toEqual([]);

  await page.sessionStorage.setItem('s1', 'v1');
  await page.sessionStorage.setItem('s2', 'v2');
  expect(new Set(await page.sessionStorage.items())).toEqual(new Set([
    { name: 's1', value: 'v1' },
    { name: 's2', value: 'v2' },
  ]));
  expect(await page.sessionStorage.getItem('s1')).toBe('v1');

  await page.sessionStorage.removeItem('s1');
  expect(await page.sessionStorage.items()).toEqual([{ name: 's2', value: 'v2' }]);

  await page.sessionStorage.clear();
  expect(await page.sessionStorage.items()).toEqual([]);
});

it('localStorage and sessionStorage are independent', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.localStorage.setItem('shared', 'local');
  await page.sessionStorage.setItem('shared', 'session');

  expect(await page.localStorage.getItem('shared')).toBe('local');
  expect(await page.sessionStorage.getItem('shared')).toBe('session');

  await page.localStorage.clear();
  expect(await page.localStorage.items()).toEqual([]);
  expect(await page.sessionStorage.getItem('shared')).toBe('session');
});

it('storage methods are scoped to the current origin', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/empty.html');
  await page.localStorage.setItem('k', 'origin-1');

  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(await page.localStorage.items()).toEqual([]);
  await page.localStorage.setItem('k', 'origin-2');

  await page.goto(server.PREFIX + '/empty.html');
  expect(await page.localStorage.getItem('k')).toBe('origin-1');
});
