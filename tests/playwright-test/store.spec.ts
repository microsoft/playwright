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
      import { test, store, expect } from '@playwright/test';
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
      import { test, store, expect } from '@playwright/test';
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
      import { test, store, expect } from '@playwright/test';
      test('should get data from setup', async ({ }) => {
        expect(await store.get('number')).toBe(2022);
        expect(await store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'b.test.ts': `
      import { test, store, expect } from '@playwright/test';
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
      import { test, store, expect } from '@playwright/test';
      test('should have no data on first run', async ({ }) => {
        expect(await store.get('number')).toBe(undefined);
        await store.set('number', 2022)
        expect(await store.get('object')).toBe(undefined);
        await store.set('object', { 'a': 2022 })
      });
    `,
    'b.test.ts': `
      import { test, store, expect } from '@playwright/test';
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
      import { test, store, expect } from '@playwright/test';
      test('should save storageState', async ({ page, context }) => {
        expect(await store.get('user')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await store.set('user', state);
      });
    `,
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
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
      import { test, expect } from '@playwright/test';
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
  const storeDir = test.info().outputPath('playwright');
  const file = path.join(storeDir, 'foo/bar.json');
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify({ 'a': 2023 }));
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should store number', async ({ }) => {
        expect(await store.get('foo/bar.json')).toEqual({ 'a': 2023 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should return root path', async ({ runInlineTest }) => {
  const storeDir = test.info().outputPath('playwright');
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should store number', async ({ }) => {
        expect(store.root()).toBe('${storeDir.replace(/\\/g, '\\\\')}');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work in global setup and teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      import { store, expect } from '@playwright/test';
      module.exports = async () => {
        expect(store).toBeTruthy();
        await store.set('foo/bar.json', {'a': 2023});
      };
    `,
    'globalTeardown.ts': `
      import { store, expect } from '@playwright/test';
      module.exports = async () => {
        const val = await store.get('foo/bar.json');
        console.log('teardown=' + val);
      };
    `,
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should read value from global setup', async ({ }) => {
        expect(await store.get('foo/bar.json')).toEqual({ 'a': 2023 });
        await store.set('foo/bar.json', 'from test');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('store root can be changed with TestConfig.storeDir', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        storeDir: 'my/store/dir',
      };
    `,
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should store value', async ({ }) => {
        await store.set('foo/bar.json', {'a': 2023});
      });
      test('should read value', async ({ }) => {
        expect(await store.get('foo/bar.json')).toEqual({ 'a': 2023 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const file = path.join(test.info().outputPath(), 'my/store/dir/foo/bar.json');
  expect(JSON.parse(await fs.promises.readFile(file, 'utf-8'))).toEqual({ 'a': 2023 });
});

test('should delete value', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should store value', async ({ }) => {
        await store.set('foo/bar.json', {'a': 2023});
        expect(await store.get('foo/bar.json')).toEqual({ 'a': 2023 });
        await store.delete('foo/bar.json');
        expect(await store.get('foo/bar.json')).toBe(undefined);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
