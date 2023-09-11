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

test('should have correct tags when calling test()', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'stdio.spec.js': `
      import { test, expect } from '@playwright/test';
      test('no tags', () => {
        expect(test.info().tags).toEqual([]);
      });
      test.tag('foo')('one tag', () => {
        expect(test.info().tags).toEqual(['foo']);
      });
      test.tag('foo', 'bar')('two tags (same invocations)', () => {
        expect(test.info().tags).toEqual(['foo', 'bar']);
      });
      test.tag('foo').tag('bar')('two tags (multiple invocations)', () => {
        expect(test.info().tags).toEqual(['foo', 'bar']);
      });
      test.tag('foo').describe('suite', () => {
        test('parent tag of describe', () => {
          expect(test.info().tags).toEqual([]);
        });
      });
      test.describe('suite', () => {
        test.describe.configure({ tags: ['bar'] })
        test.tag('foo')('test.tag() + test.describe()', () => {
          expect(test.info().tags).toEqual(['bar', 'foo']);
        });
      });
    `
  });
  expect(exitCode).toBe(0);
  expect(passed).toBe(6);
});

test.describe('config.tags', () => {
  test('config.tags (string) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = { tags: 'tag1' };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

  test('config.tags (string[]) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = { tags: ['tag1'] };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

  test('config.tags (RegExp) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = { tags: /tag1/ };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

});
test.describe('config.tagInvert', () => {
  test('config.tagInvert (string) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = { tagsInvert: 'tag1' };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test2']);
  });

  test('config.tagInvert (string[]) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = { tagsInvert: ['tag1'] };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test2']);
  });

  test('config.tagInvert (RegExp) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = { tagsInvert: /tag1/ };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test2']);
  });

});
test.describe('config[project].tags', () => {
  test('config[project].tags (string) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'foobar',
          tags: 'tag1',
        }]
      };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

  test('config[project].tags (string[]) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'foobar',
          tags: ['tag1'],
        }]
      };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

  test('config[project].tags (RegExp) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'foobar',
          tags: /tag1/,
        }]
      };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

});
test.describe('config[project].tagsInvert', () => {
  test('config[project].tagsInvert (string) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'foobar',
          tagsInvert: 'tag1',
        }]
      };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test2']);
  });

  test('config[project].tagsInvert (string[]) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'foobar',
          tagsInvert: ['tag1'],
        }]
      };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test2']);
  });

  test('config[project].tagsInvert (RegExp) should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'foobar',
          tagsInvert: /tag1/,
        }]
      };
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test2']);
  });
});

test.describe('CLI', () => {
  test('--tag should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {};
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    }, { 'tag': 'tag1' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });

  test('--tag should work with a RegExp', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {};
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test.tag('tag2')('test2', async () => { console.log('\\n%% test2'); });
      test.tag('tag3')('test3', async () => { console.log('\\n%% test3'); });
    `,
    }, { 'tag': 'tag1|tag2' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['test1', 'test2']);
  });

  test('--tag-invert should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      module.exports = {};
    `,
      'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.tag('tag1')('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
    }, { 'tag': 'tag1' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['test1']);
  });
});
