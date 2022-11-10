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

test('should provide storage fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('should store number', async ({ }) => {
        const storage = test.info().storage();
        expect(storage).toBeTruthy();
        expect(await storage.get('number')).toBe(undefined);
        await storage.set('number', 2022)
        expect(await storage.get('number')).toBe(2022);
      });
      test('should store object', async ({ }) => {
        const storage = test.info().storage();
        expect(storage).toBeTruthy();
        expect(await storage.get('object')).toBe(undefined);
        await storage.set('object', { 'a': 2022 })
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should share storage state between project setup and tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            setup: /.*storage.setup.ts/
          }
        ]
      };
    `,
    'storage.setup.ts': `
      const { test, expect } = pwt;
      test('should initialize storage', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(undefined);
        await storage.set('number', 2022)
        expect(await storage.get('number')).toBe(2022);

        expect(await storage.get('object')).toBe(undefined);
        await storage.set('object', { 'a': 2022 })
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should persist storage state between project runs', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.js': `
      module.exports = { };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('should have no data on first run', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(undefined);
        await storage.set('number', 2022)
        expect(await storage.get('object')).toBe(undefined);
        await storage.set('object', { 'a': 2022 })
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should get data from previous run', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
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

test('should isolate storage state between projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            setup: /.*storage.setup.ts/
          },
          {
            name: 'p2',
            setup: /.*storage.setup.ts/
          }
        ]
      };
    `,
    'storage.setup.ts': `
      const { test, expect } = pwt;
      test('should initialize storage', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(undefined);
        await storage.set('number', 2022)
        expect(await storage.get('number')).toBe(2022);

        expect(await storage.get('name')).toBe(undefined);
        await storage.set('name', 'str-' + test.info().project.name)
        expect(await storage.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ }) => {
        const storage = test.info().storage();
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(6);
});

test('should load context storageState from storage', async ({ runInlineTest, server }) => {
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
            setup: /.*storage.setup.ts/
          }
        ]
      };
    `,
    'storage.setup.ts': `
      const { test, expect } = pwt;
      test('should save storageState', async ({ page, context }) => {
        const storage = test.info().storage();
        expect(await storage.get('user')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await storage.set('user', state);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
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

test('should load storageStateName specified in the project config from storage', async ({ runInlineTest, server }) => {
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
            setup: /.*storage.setup.ts/,
            use: {
              storageStateName: 'stateInStorage',
            },
          }
        ]
      };
    `,
    'storage.setup.ts': `
      const { test, expect } = pwt;
      test.use({
        storageStateName: ({}, use) => use(undefined),
      })
      test('should save storageState', async ({ page, context }) => {
        const storage = test.info().storage();
        expect(await storage.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await storage.set('stateInStorage', state);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
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

test('should load storageStateName specified in the global config from storage', async ({ runInlineTest, server }) => {
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
            setup: /.*storage.setup.ts/,
          }
        ]
      };
    `,
    'storage.setup.ts': `
      const { test, expect } = pwt;
      test.use({
        storageStateName: ({}, use) => use(undefined),
      })
      test('should save storageStateName', async ({ page, context }) => {
        const storage = test.info().storage();
        expect(await storage.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await storage.set('stateInStorage', state);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
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
      const { test } = pwt;
      test('should fail to initialize page', async ({ page }) => {
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Error: Cannot find value in the storage for storageStateName: "stateInStorage"');
});