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

test('should provide _store fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      const { test, _store } = pwt;
      test('should _store number', async ({ }) => {
        expect(_store).toBeTruthy();
        expect(await _store.get('number')).toBe(undefined);
        await _store.set('number', 2022)
        expect(await _store.get('number')).toBe(2022);
      });
      test('should _store object', async ({ }) => {
        expect(_store).toBeTruthy();
        expect(await _store.get('object')).toBe(undefined);
        await _store.set('object', { 'a': 2022 })
        expect(await _store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should share _store state between project setup and tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            _setupMatch: /.*_store.setup.ts/
          }
        ]
      };
    `,
    '_store.setup.ts': `
      const { _setup, expect, _store } = pwt;
      _setup('should initialize _store', async ({ }) => {
        expect(await _store.get('number')).toBe(undefined);
        await _store.set('number', 2022)
        expect(await _store.get('number')).toBe(2022);

        expect(await _store.get('object')).toBe(undefined);
        await _store.set('object', { 'a': 2022 })
        expect(await _store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'a.test.ts': `
      const { test, _store } = pwt;
      test('should get data from setup', async ({ }) => {
        expect(await _store.get('number')).toBe(2022);
        expect(await _store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
    'b.test.ts': `
      const { test, _store } = pwt;
      test('should get data from setup', async ({ }) => {
        expect(await _store.get('number')).toBe(2022);
        expect(await _store.get('object')).toEqual({ 'a': 2022 });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should persist _store state between project runs', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.js': `
      module.exports = { };
    `,
    'a.test.ts': `
      const { test, _store } = pwt;
      test('should have no data on first run', async ({ }) => {
        expect(await _store.get('number')).toBe(undefined);
        await _store.set('number', 2022)
        expect(await _store.get('object')).toBe(undefined);
        await _store.set('object', { 'a': 2022 })
      });
    `,
    'b.test.ts': `
      const { test, _store } = pwt;
      test('should get data from previous run', async ({ }) => {
        expect(await _store.get('number')).toBe(2022);
        expect(await _store.get('object')).toEqual({ 'a': 2022 });
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

test('should isolate _store state between projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            _setupMatch: /.*_store.setup.ts/
          },
          {
            name: 'p2',
            _setupMatch: /.*_store.setup.ts/
          }
        ]
      };
    `,
    '_store.setup.ts': `
      const { _setup, expect, _store } = pwt;
      _setup('should initialize _store', async ({ }) => {
        expect(await _store.get('number')).toBe(undefined);
        await _store.set('number', 2022)
        expect(await _store.get('number')).toBe(2022);

        expect(await _store.get('name')).toBe(undefined);
        await _store.set('name', 'str-' + _setup.info().project.name)
        expect(await _store.get('name')).toBe('str-' + _setup.info().project.name);
      });
    `,
    'a.test.ts': `
      const { test, _store } = pwt;
      test('should get data from setup', async ({ }) => {
        expect(await _store.get('number')).toBe(2022);
        expect(await _store.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
    'b.test.ts': `
      const { test, _store } = pwt;
      test('should get data from setup', async ({ }) => {
        expect(await _store.get('number')).toBe(2022);
        expect(await _store.get('name')).toBe('str-' + test.info().project.name);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(6);
});

test('should load context storageState from _store', async ({ runInlineTest, server }) => {
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
            _setupMatch: /.*_store.setup.ts/
          }
        ]
      };
    `,
    '_store.setup.ts': `
      const { _setup, expect, _store } = pwt;
      _setup('should save storageState', async ({ page, context }) => {
        expect(await _store.get('user')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await _store.set('user', state);
      });
    `,
    'a.test.ts': `
      const { test } = pwt;
      test.use({
        _storageStateName: 'user'
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

test('should load _storageStateName specified in the project config from _store', async ({ runInlineTest, server }) => {
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
            _setupMatch: /.*_store.setup.ts/,
            use: {
              _storageStateName: 'stateInStorage',
            },
          }
        ]
      };
    `,
    '_store.setup.ts': `
      const { _setup, expect, _store } = pwt;
      _setup.use({
        _storageStateName: ({}, use) => use(undefined),
      })
      _setup('should save storageState', async ({ page, context }) => {
        expect(await _store.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await _store.set('stateInStorage', state);
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

test('should load _storageStateName specified in the global config from _store', async ({ runInlineTest, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v1']);
    res.end();
  });
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          _storageStateName: 'stateInStorage',
        },
        projects: [
          {
            name: 'p1',
            _setupMatch: /.*_store.setup.ts/,
          }
        ]
      };
    `,
    '_store.setup.ts': `
      const { _setup, expect, _store } = pwt;
      _setup.use({
        _storageStateName: ({}, use) => use(undefined),
      })
      _setup('should save _storageStateName', async ({ page, context }) => {
        expect(await _store.get('stateInStorage')).toBe(undefined);
        await page.goto('${server.PREFIX}/setcookie.html');
        const state = await page.context().storageState();
        await _store.set('stateInStorage', state);
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

test('should throw on unknown _storageStateName value', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          {
            name: 'p1',
            use: {
              _storageStateName: 'stateInStorage',
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
  expect(result.output).toContain('Error: Cannot find value in the _store for _storageStateName: "stateInStorage"');
});