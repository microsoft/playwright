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
import { expect, test } from './playwright-test-fixtures';

test('should provide store fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      const { test, store } = pwt;
      test('should store number', async ({ }) => {
        expect(store).toBeTruthy();
        expect(await store.get('number')).toBe(undefined);
        await store.set('number', 2022)
        expect(await store.get('number')).toBe(2022);
      });
      test('should store object', async ({ }) => {
        expect(store).toBeTruthy();
        expect(await store.get('object')).toBe(undefined);
        await store.set('object', { 'a': 2022 })
        expect(await store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should share store state between project setup and tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            testMatch: /.*store.setup.ts/
          },
          {
            name: 'p2',
            dependencies: ['p1'],
            testMatch: /.*.test.ts/
          }
        ]
      };
    `,
    'store.setup.ts': `
      const { test, expect, store } = pwt;
      test('should initialize store', async ({ }) => {
        expect(await store.get('number')).toBe(undefined);
        await store.set('number', 2022)
        expect(await store.get('number')).toBe(2022);

        expect(await store.get('object')).toBe(undefined);
        await store.set('object', { 'a': 2022 })
        expect(await store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'a.test.ts': `
      const { test, store } = pwt;
      test('should get data from setup', async ({ }) => {
        expect(await store.get('number')).toBe(2022);
        expect(await store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'b.test.ts': `
      const { test, store } = pwt;
      test('should get data from setup', async ({ }) => {
        expect(await store.get('number')).toBe(2022);
        expect(await store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should persist store state between project runs', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.js': `
      module.exports = { };
    `,
    'a.test.ts': `
      const { test, store } = pwt;
      test('should have no data on first run', async ({ }) => {
        expect(await store.get('number')).toBe(undefined);
        await store.set('number', 2022)
        expect(await store.get('object')).toBe(undefined);
        await store.set('object', { 'a': 2022 })
      });
    `,
    'b.test.ts': `
      const { test, store } = pwt;
      test('should get data from previous run', async ({ }) => {
        expect(await store.get('number')).toBe(2022);
        expect(await store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  };
  {
    const result = await runInlineTest(files, { grep: 'should have no data on first run' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  }
  {
    const result = await runInlineTest(files, { grep: 'should get data from previous run' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  }
});

test('should isolate store state between projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
          },
          {
            name: 'p2',
          }
        ]
      };
    `,
    'a.spec.ts': `
      const { test, store } = pwt;
      const storageKey = name => test.info().project.name + '/' + name;

      test('should initialize store', async ({ }) => {
        expect(await store.get(storageKey('number'))).toBe(undefined);
        await store.set(storageKey('number'), 2022)
        expect(await store.get(storageKey('number'))).toBe(2022);

        expect(await store.get(storageKey('name'))).toBe(undefined);
        await store.set(storageKey('name'), 'str-' + test.info().project.name)
        expect(await store.get(storageKey('name'))).toBe('str-' + test.info().project.name);
      });

      test('should get data from setup', async ({ }) => {
        expect(await store.get(storageKey('number'))).toBe(2022);
        expect(await store.get(storageKey('name'))).toBe('str-' + test.info().project.name);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
});

test('should load context storageState from store', async ({ runInlineTest, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v1']);
    res.end();
  });
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'setup',
            testMatch: /.*store.setup.ts/
          },
          {
            name: 'p2',
            dependencies: ['setup'],
            testMatch: /.*.test.ts/
          }
        ]
      };
    `,
    'store.setup.ts': `
      const { test, expect, store } = pwt;
      test('should save storageState', async ({ page, context }) => {
        expect(await store.get('user')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await store.set('user', state);
      });
    `,
    'a.test.ts': `
      const { test, store } = pwt;
      test.use({
        storageState: async ({}, use) => use(store.get('user'))
      })
      test('should get data from setup', async ({ page }) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('a=v1');
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should not get data from setup if not configured', async ({ page }) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should load value from filesystem', async ({ runInlineTest }) => {
  const storeDir = path.join(test.info().outputPath(), '.playwright-store');
  const file = path.join(storeDir, 'foo/bar.json');
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify({ 'a': 2023 }));
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      const { test, store } = pwt;
      test('should store number', async ({ }) => {
        expect(await store.get('foo/bar')).toEqual({ 'a': 2023 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
