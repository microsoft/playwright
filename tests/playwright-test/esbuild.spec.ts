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

import { test, expect, parseTestRunnerOutput } from './playwright-test-fixtures';

const env = { PLAYWRIGHT_EXPERIMENTAL_ESBUILD: '1' };

test('should transpile typescript', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      enum Direction { Up = 1, Down }
      namespace Shapes { export const sides = 4; }
      namespace Shapes { export const corners = sides; }

      function tagged(value: any, context: ClassMethodDecoratorContext) {
        return function (this: any) { return 'tagged:' + value.call(this); };
      }

      class Base {
        page: string;
        constructor(page: string) { this.page = page; }
      }

      class LoginPage extends Base {
        declare page: string;
        readonly title = this.page + '-title';
        constructor(page: string, private readonly user = 'admin') { super(page); }
        @tagged name() { return this.user; }
      }

      test('works', () => {
        expect(Direction.Down).toBe(2);
        expect(Shapes.corners).toBe(4);
        const loginPage = new LoginPage('login');
        expect(loginPage.page).toBe('login');
        expect(loginPage.title).toBe('login-title');
        expect(loginPage.name()).toBe('tagged:admin');
      });
    `,
  }, {}, env);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should map locations to sources', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      enum Answer { Yes = 'yes' }
      test('fails', () => {
        expect(Answer.Yes as string).toBe('no');
      });
    `,
  }, { reporter: 'list' }, env);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('a.spec.ts:4:7 › fails');
  expect(result.output).toContain(`> 5 |         expect(Answer.Yes as string).toBe('no');`);
  expect(result.output).toContain('a.spec.ts:5:38');
});

test('should support ESM packages', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      import type { PlaywrightTestConfig } from '@playwright/test';
      const config: PlaywrightTestConfig = { projects: [{ name: 'esm' }] };
      export default config;
    `,
    'helper.ts': `
      export enum Color { Red = 'red' }
      export class Box { constructor(readonly color: Color) {} }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      import { Box, Color } from './helper';
      test('works', () => {
        expect(new Box(Color.Red).color).toBe('red');
      });
    `,
  }, {}, env);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect tsconfig paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@lib/*": ["./lib/*"] },
      },
    }`,
    'lib/util.ts': `
      export const value: number = 42;
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      import { value } from '@lib/util';
      test('works', () => {
        expect(value).toBe(42);
      });
    `,
  }, {}, env);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect tsconfig jsx options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tsconfig.json': `{
      "compilerOptions": { "jsx": "react", "jsxFactory": "h" },
    }`,
    'a.spec.tsx': `
      import { test, expect } from '@playwright/test';
      const h = (tag: string, props: any, ...children: any[]) => ({ tag, props, children });
      test('works', () => {
        expect(<div id="x">text</div>).toEqual({ tag: 'div', props: { id: 'x' }, children: ['text'] });
      });
    `,
  }, {}, env);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should transpile global teardown after sigint', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'playwright.config.ts': `
      export default {
        globalSetup: './globalSetup.ts',
        globalTeardown: './globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      export default () => {
        console.log('Global setup');
        console.log('%%SEND-SIGINT%%');
        return new Promise(f => setTimeout(f, 30000));
      };
    `,
    'globalTeardown.ts': `
      export default (): void => {
        console.log('Global teardown');
      };
    `,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('test', async () => {});
    `,
  }, { workers: 1 }, env);
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.output).toContain('Global teardown');
});
