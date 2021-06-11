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

test('globalSetup and globalTeardown should work', async ({ runInlineTest }) => {
  const { results, output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
        globalTeardown: path.join(__dirname, 'globalTeardown.ts'),
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        await new Promise(f => setTimeout(f, 100));
        global.value = 42;
        process.env.FOO = String(global.value);
      };
    `,
    'globalTeardown.ts': `
      module.exports = async () => {
        console.log('teardown=' + global.value);
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('should work', async ({}, testInfo) => {
        expect(process.env.FOO).toBe('42');
      });
    `,
  });
  expect(results[0].status).toBe('passed');
  expect(output).toContain('teardown=42');
});

test('globalTeardown runs after failures', async ({ runInlineTest }) => {
  const { results, output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        await new Promise(f => setTimeout(f, 100));
        global.value = 42;
        process.env.FOO = String(global.value);
      };
    `,
    'globalTeardown.ts': `
      module.exports = async () => {
        console.log('teardown=' + global.value);
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('should work', async ({}, testInfo) => {
        expect(process.env.FOO).toBe('43');
      });
    `,
  });
  expect(results[0].status).toBe('failed');
  expect(output).toContain('teardown=42');
});

test('globalTeardown does not run when globalSetup times out', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
        globalTimeout: 1000,
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        await new Promise(f => setTimeout(f, 10000));
      };
    `,
    'globalTeardown.ts': `
      module.exports = async () => {
        console.log('teardown=');
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('should not run', async ({}, testInfo) => {
      });
    `,
  });
  // We did not collect tests, so everything should be zero.
  expect(result.skipped).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain('teardown=');
});

test('globalSetup should be run before requiring tests', async ({ runInlineTest }) => {
  const { passed } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        process.env.FOO = JSON.stringify({ foo: 'bar' });
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      let value = JSON.parse(process.env.FOO);
      test('should work', async ({}) => {
        expect(value).toEqual({ foo: 'bar' });
      });
    `,
  });
  expect(passed).toBe(1);
});

test('globalSetup should work with sync function', async ({ runInlineTest }) => {
  const { passed } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = () => {
        process.env.FOO = JSON.stringify({ foo: 'bar' });
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      let value = JSON.parse(process.env.FOO);
      test('should work', async ({}) => {
        expect(value).toEqual({ foo: 'bar' });
      });
    `,
  });
  expect(passed).toBe(1);
});

test('globalSetup should throw when passed non-function', async ({ runInlineTest }) => {
  const { output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = 42;
    `,
    'a.test.js': `
      const { test } = pwt;
      test('should work', async ({}) => {
      });
    `,
  });
  expect(output).toContain(`globalSetup file must export a single function.`);
});

test('globalSetup should work with default export and run the returned fn', async ({ runInlineTest }) => {
  const { output, exitCode, passed } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      function setup() {
        let x = 42;
        console.log('\\n%%setup: ' + x);
        return async () => {
          await x;
          console.log('\\n%%teardown: ' + x);
        };
      }
      export default setup;
    `,
    'a.test.js': `
      const { test } = pwt;
      test('should work', async ({}) => {
      });
    `,
  });
  expect(passed).toBe(1);
  expect(exitCode).toBe(0);
  expect(output).toContain(`%%setup: 42`);
  expect(output).toContain(`%%teardown: 42`);
});
