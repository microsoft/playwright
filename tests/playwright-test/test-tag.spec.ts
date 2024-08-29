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

import { test, expect } from './playwright-test-fixtures';

test('should have correct tags', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      export default class Reporter {
        onBegin(config, suite) {
          const visit = suite => {
            for (const test of suite.tests || [])
              console.log('\\n%%title=' + test.title + ', tags=' + test.tags.join(','));
            for (const child of suite.suites || [])
              visit(child);
          };
          visit(suite);
        }
        onError(error) {
          console.log(error);
        }
      }
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'stdio.spec.js': `
      import { test, expect } from '@playwright/test';
      test('no-tags', () => {
      });
      test('foo-tag @inline', { tag: '@foo' }, () => {
      });
      test('foo-bar-tags', { tag: ['@foo', '@bar'] }, () => {
      });
      test.skip('skip-foo-tag', { tag: '@foo' }, () => {
      });
      test.fixme('fixme-bar-tag', { tag: '@bar' }, () => {
      });
      test.fail('fail-foo-bar-tags', { tag: ['@foo', '@bar'] }, () => {
        expect(1).toBe(2);
      });
      test.describe('suite @inline', { tag: '@foo' }, () => {
        test('foo-suite', () => {
        });
        test.describe('inner', { tag: '@bar' }, () => {
          test('foo-bar-suite', () => {
          });
        });
      });
      test.describe.skip('skip-foo-suite', { tag: '@foo' }, () => {
        test('skip-foo-suite', () => {
        });
      });
      test.describe.fixme('fixme-bar-suite', { tag: '@bar' }, () => {
        test('fixme-bar-suite', () => {
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    `title=no-tags, tags=`,
    `title=foo-tag @inline, tags=@inline,@foo`,
    `title=foo-bar-tags, tags=@foo,@bar`,
    `title=skip-foo-tag, tags=@foo`,
    `title=fixme-bar-tag, tags=@bar`,
    `title=fail-foo-bar-tags, tags=@foo,@bar`,
    `title=foo-suite, tags=@inline,@foo`,
    `title=foo-bar-suite, tags=@inline,@foo,@bar`,
    `title=skip-foo-suite, tags=@foo`,
    `title=fixme-bar-suite, tags=@bar`,
  ]);
});

test('config.grep should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { grep: /@tag1/ };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', { tag: '@tag1' }, async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual(['test1']);
});

test('config.project.grep should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'p1' },
        { name: 'p2', grep: /@tag1/ }
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', { tag: '@tag1' }, async () => { console.log('\\n%% test1-' + test.info().project.name); });
      test('test2', async () => { console.log('\\n%% test2-' + test.info().project.name); });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toEqual(['test1-p1', 'test2-p1', 'test1-p2']);
});

test('--grep should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', { tag: '@tag1' }, async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
  }, { grep: '@tag1' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual(['test1']);
});

test('should enforce @ symbol', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'stdio.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test1', { tag: 'foo' }, () => {
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Error: Tag must start with "@" symbol, got "foo" instead.`);
});

test('types should enforce @ symbol', async ({ runTSC }) => {
  const result = await runTSC({
    'stdio.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', { tag: 'foo' }, () => {
      });
    `
  });
  expect(result.exitCode).toBe(2);
  expect(result.output).toContain('error TS2322: Type \'"foo"\' is not assignable to type \'`@${string}` | `@${string}`[] | undefined');
});

test('should be included in testInfo', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test without tag', async ({}, testInfo) => {
      expect(testInfo.tags).toStrictEqual([]);
    });
    test('test with tag',{ tag: '@tag1' }, async ({}, testInfo) => {
      expect(testInfo.tags).toStrictEqual(["@tag1"]);
    });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should be included in testInfo if coming from describe', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test.describe('describe with tag', { tag: '@tag2' }, async ()=>{
      test('test with tag', async ({}, testInfo) => {
        expect(testInfo.tags).toStrictEqual(["@tag2"]);
      });
    });
    `,
  });
  expect(result.exitCode).toBe(0);
});
