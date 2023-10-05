/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

test('config.grep should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { grep: /test1/ };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('%% test1');
});

test('config.grepInvert should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { grepInvert: /test1/ };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('%% test2');
});

test('project.grep should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [ { grep: /test1/ } ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('%% test1');
});

test('project.grepInvert should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [ { grepInvert: /test1/ } ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('%% test2');
});

test('config.grep should intersect with --grep and --grepInvert', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { grep: /test./, grepInvert: /test4/ };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async () => { console.log('\\n%% test1'); });
      test('test2', async () => { console.log('\\n%% test2'); });
      test('test3', async () => { console.log('\\n%% test3'); });
      test('test4', async () => { console.log('\\n%% test4'); });
    `,
  }, { 'grep': 'test[23]', 'grep-invert': '..st3' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('%% test2');
});
