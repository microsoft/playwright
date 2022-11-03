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
      test('should store number', async ({ storage }) => {
        expect(storage).toBeTruthy();
        expect(await storage.get('number')).toBe(undefined);
        await storage.set('number', 2022)
        expect(await storage.get('number')).toBe(2022);
      });
      test('should store object', async ({ storage }) => {
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
      test('should initialize storage', async ({ storage }) => {
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
      test('should get data from setup', async ({ storage }) => {
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ storage }) => {
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
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
      test('should initialize storage', async ({ storage }, testInfo) => {
        expect(await storage.get('number')).toBe(undefined);
        await storage.set('number', 2022)
        expect(await storage.get('number')).toBe(2022);

        expect(await storage.get('name')).toBe(undefined);
        await storage.set('name', 'str-' + testInfo.project.name)
        expect(await storage.get('name')).toBe('str-' + testInfo.project.name);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ storage }, testInfo) => {
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('name')).toBe('str-' + testInfo.project.name);
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ storage }, testInfo) => {
        expect(await storage.get('number')).toBe(2022);
        expect(await storage.get('name')).toBe('str-' + testInfo.project.name);
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
      test('should save storageState', async ({ page, context, storage }, testInfo) => {
        expect(await storage.get('user')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await storage.set('user', state);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
      test.use({
        storageState: 'user'
      })
      test('should get data from setup', async ({ page }, testInfo) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('a=v1');
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('should not get data from setup if not configured', async ({ page }, testInfo) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should load storageState specified in the project config from storage', async ({ runInlineTest, server }) => {
  test.fixme();
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
              storageState: 'stateInStorage',
            },
          }
        ]
      };
    `,
    'storage.setup.ts': `
      const { test, expect } = pwt;
      test.use({
        storageState: undefined
      })
      test('should save storageState', async ({ page, context, storage }, testInfo) => {
        expect(await storage.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await storage.set('stateInStorage', state);
        console.log('project setup state = ' + state);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('should get data from setup', async ({ page, storage }, testInfo) => {
        await page.goto('${server.EMPTY_PAGE}');
        const cookies = await page.evaluate(() => document.cookie);
        expect(cookies).toBe('a=v1');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});