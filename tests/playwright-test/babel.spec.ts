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

test('should succeed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'one-success.spec.ts': `
      import { test, expect } from '@playwright/test';

      class Foo {
        #logger = 2;
        get #log() { return this.#logger; }
        value() { return this.#log; };
      }

      test('succeeds', () => {
        expect(new Foo().value()).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
});

test('should treat enums equally', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'component.tsx': `
      export enum MyEnum {
        Value = "value",
      };

      export const enum MyConstEnum {
        Value = "value",
      }
    `,
    'regular.ts': `
      export enum MyEnum {
        Value = "value",
      };

      export const enum MyConstEnum {
        Value = "value",
      }
    `,
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';

      import * as components from './component';
      import * as regular from './regular';

      test('works', () => {
        expect.soft(components.MyEnum.Value).toBe("value");
        expect.soft(components.MyConstEnum.Value).toBe("value");
        expect.soft(regular.MyEnum.Value).toBe("value");
        expect.soft(regular.MyConstEnum.Value).toBe("value");
      })
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should be able to access |this| inside class properties', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21794' });
  const result = await runInlineTest({
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';

      class Foo {
        constructor(private readonly incoming: number) {}
        value = this.incoming;
      }

      test('works', () => {
        expect(new Foo(42).value).toBe(42);
      })
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with |const| Type Parameters', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21900' });
  const result = await runInlineTest({
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('works', () => {
        type HasNames = { names: readonly string[] };
        function getNamesExactly<const T extends HasNames>(arg: T): T['names'] {
        //                       ^^^^^
            return arg.names;
        }
        const names = getNamesExactly({ names: ['Alice', 'Bob', 'Eve'] });
        console.log('names: ' + names.join(', '))
      })
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('names: Alice, Bob, Eve');
});

test('should not read browserslist file', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23125' });
  const result = await runInlineTest({
    'package.json': `{ "browserslist": ["some invalid! value :)"] }`,
    'one-success.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
});

test('should not transform external', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        build: {
          external: ['**/a.spec.ts']
        }
      });
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toMatch(/(Cannot use import statement outside a module|require\(\) of ES Module .* not supported.)/);
});

for (const type of ['module', undefined]) {
  test(`should support import assertions with type=${type} in the package.json`, {
    annotation: {
      type: 'issue',
      description: 'https://github.com/microsoft/playwright/issues/32659'
    }
  }, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
      import packageJSON from './package.json' assert { type: 'json' };
      console.log('imported value: ' + packageJSON.foo);
      export default { };
    `,
      'package.json': JSON.stringify({ foo: 'bar', type }),
      'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('check project name', ({}, testInfo) => {
        expect(1).toBe(1);
      });
    `
    });

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.stdout).toContain('imported value: bar');
  });
}
