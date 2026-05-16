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

const fixtureFiles = (skipFixtures: boolean) => ({
  'playwright.config.js': `
    module.exports = { skipFixtures: ${skipFixtures} };
  `,
  'fixtures.ts': `
    import { test as base } from '@playwright/test';
    export const test = base.extend({
      tracked: async ({}, use) => {
        console.log('%%SETUP-tracked');
        await use('value');
        console.log('%%TEARDOWN-tracked');
      },
    });
  `,
});

test('skipFixtures=true: static test.skip() does not run fixture setup', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...fixtureFiles(true),
    'a.spec.ts': `
      import { test } from './fixtures';
      test.skip('skipped', async ({ tracked }) => { console.log('%%BODY'); });
      test('normal', async ({ tracked }) => { console.log('%%BODY'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.outputLines.filter(l => l === 'SETUP-tracked').length).toBe(1);
  expect(result.outputLines).toContain('BODY');
});

test('skipFixtures=true: conditional test.skip() in beforeEach modifier does not run user fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...fixtureFiles(true),
    'a.spec.ts': `
      import { test } from './fixtures';
      test.describe(() => {
        test.skip(() => true, 'always skip');
        test('one', async ({ tracked }) => { console.log('%%BODY'); });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.outputLines.filter(l => l === 'SETUP-tracked').length).toBe(0);
});

test('skipFixtures=true: as last test in worker, still no fixture setup', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...fixtureFiles(true),
    'a.spec.ts': `
      import { test } from './fixtures';
      test('normal', async ({ tracked }) => { console.log('%%BODY'); });
      test.skip('last-skipped', async ({ tracked }) => { console.log('%%BODY'); });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.outputLines.filter(l => l === 'SETUP-tracked').length).toBe(1);
});

test('skipFixtures=true: runtime test.skip() inside body still runs fixtures (documented limitation)', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...fixtureFiles(true),
    'a.spec.ts': `
      import { test } from './fixtures';
      test('skips-at-runtime', async ({ tracked }) => {
        test.skip();
        console.log('%%BODY');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);
  // Body must start running before test.skip() is reached, so the fixture has already been set up.
  expect(result.outputLines.filter(l => l === 'SETUP-tracked').length).toBe(1);
});

test('skipFixtures=false (default): preserves prior behavior — no regression on simple skip', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = {};`,
    'fixtures.ts': `
      import { test as base } from '@playwright/test';
      export const test = base.extend({
        tracked: async ({}, use) => { console.log('%%SETUP-tracked'); await use('v'); },
      });
    `,
    'a.spec.ts': `
      import { test } from './fixtures';
      test.skip('skipped', async ({ tracked }) => { console.log('%%BODY'); });
      test('normal', async ({ tracked }) => { console.log('%%BODY'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(1);
});

test('skipFixtures validation: non-boolean is rejected', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { skipFixtures: 'yes' };`,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('one', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('skipFixtures must be a boolean');
});
