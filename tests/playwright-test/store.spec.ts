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

import { expect, test } from './playwright-test-fixtures';

test.fixme(true, 'Restore this');

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
            setupMatch: /.*store.setup.ts/
          }
        ]
      };
    `,
    'store.setup.ts': `
      import { test, store, expect } from '@playwright/test';
      test.projectSetup('should initialize store', async ({ }) => {
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

test('should isolate store state between projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            setupMatch: /.*store.setup.ts/
          },
          {
            name: 'p2',
            setupMatch: /.*store.setup.ts/
          }
        ]
      };
    `,
    'store.setup.ts': `
      import { test, store, expect } from '@playwright/test';
      test.projectSetup('should initialize store', async ({ }) => {
        expect(await store.get('number')).toBe(undefined);
        await store.set('number', 2022)
        expect(await store.get('number')).toBe(2022);

        expect(await store.get('name')).toBe(undefined);
        await store.set('name', 'str-' + test.info().project.name)
        expect(await store.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
    'a.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should get data from setup', async ({ }) => {
        expect(await store.get('number')).toBe(2022);
        expect(await store.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
    'b.test.ts': `
      import { test, store, expect } from '@playwright/test';
      test('should get data from setup', async ({ }) => {
        expect(await store.get('number')).toBe(2022);
        expect(await store.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(6);
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
            name: 'p1',
            setupMatch: /.*store.setup.ts/
          }
        ]
      };
    `,
    'store.setup.ts': `
      import { test, store, expect } from '@playwright/test';
      test.projectSetup('should save storageState', async ({ page, context }) => {
        expect(await store.get('user')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await store.set('user', state);
      });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.use({
        storageStateName: 'user'
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

test('should load storageStateName specified in the project config from store', async ({ runInlineTest, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v1']);
    res.end();
  });
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            setupMatch: /.*store.setup.ts/,
            use: {
              storageStateName: 'stateInStorage',
            },
          }
        ]
      };
    `,
    'store.setup.ts': `
      import { test, store, expect } from '@playwright/test';
      test.use({
        storageStateName: ({}, use) => use(undefined),
      })
      test.projectSetup('should save storageState', async ({ page, context }) => {
        expect(await store.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await store.set('stateInStorage', state);
      });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should get data from setup', async ({ page }) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('a=v1');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should load storageStateName specified in the global config from store', async ({ runInlineTest, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v1']);
    res.end();
  });
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          storageStateName: 'stateInStorage',
        },
        projects: [
          {
            name: 'p1',
            setupMatch: /.*store.setup.ts/,
          }
        ]
      };
    `,
    'store.setup.ts': `
      import { test, store, expect } from '@playwright/test';
      test.use({
        storageStateName: ({}, use) => use(undefined),
      })
      test.projectSetup('should save storageStateName', async ({ page, context }) => {
        expect(await store.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await store.set('stateInStorage', state);
      });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should get data from setup', async ({ page }) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('a=v1');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should throw on unknown storageStateName value', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            use: {
              storageStateName: 'stateInStorage',
            },
          }
        ]
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail to initialize page', async ({ page }) => {
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Error: Cannot find value in the store for storageStateName: "stateInStorage"');
});