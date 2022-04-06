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

test('should respect path resolver', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11656' });

  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
          "util2/*": ["./foo/bar/util/*"],
          "util3": ["./does-not-exist", "./foo/bar/util/b"],
        },
      },
    }`,
    'a.test.ts': `
      import { foo } from 'util/b';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'b.test.ts': `
      import { foo } from 'util2/b';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'c.test.ts': `
      import { foo } from 'util3';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
    'helper.ts': `
      export { foo } from 'util3';
    `,
    'dir/tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "parent-util/*": ["../foo/bar/util/*"],
        },
      },
    }`,
    'dir/inner.spec.ts': `
      // This import should pick up <root>/dir/tsconfig
      import { foo } from 'parent-util/b';
      // This import should pick up <root>/tsconfig through the helper
      import { foo as foo2 } from '../helper';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
        expect(testInfo.project.name).toBe(foo2);
      });
    `,
  });

  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain(`Could not`);
});

test('should respect baseurl', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": "./foo",
        "paths": {
          "util/*": ["./bar/util/*"],
          "util2": ["./bar/util/b"],
        },
      },
    }`,
    'a.test.ts': `
      import { foo } from 'util/b';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'b.test.ts': `
      import { foo } from 'util2';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
  });

  expect(result.passed).toBe(2);
  expect(result.exitCode).toBe(0);
});

test('should respect baseurl w/o paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'foo/bar/util/b.ts': `
      export const foo = 42;
    `,
    'dir2/tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": "..",
      },
    }`,
    'dir2/inner.spec.ts': `
      // This import should pick up ../foo/bar/util/b due to baseUrl.
      import { foo } from 'foo/bar/util/b';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(foo).toBe(42);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`Could not`);
});

test('should respect complex path resolver', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "prefix-*": ["./prefix-*/bar"],
          "prefix-*-suffix": ["./prefix-*-suffix/bar"],
          "*-suffix": ["./*-suffix/bar"],
          "no-star": ["./no-star-foo"],
          "longest-*": ["./this-is-not-the-longest-prefix"],
          "longest-pre*": ["./this-is-the-longest-prefix"],
          "*bar": ["./*bar"],
          "*[bar]": ["*foo"],
        },
      },
    }`,
    'a.spec.ts': `
      import { foo } from 'prefix-matchedstar';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'prefix-matchedstar/bar/index.ts': `
      export const foo: string = 'foo';
    `,
    'b.spec.ts': `
      import { foo } from 'prefix-matchedstar-suffix';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'prefix-matchedstar-suffix/bar.ts': `
      export const foo: string = 'foo';
    `,
    'c.spec.ts': `
      import { foo } from 'matchedstar-suffix';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'matchedstar-suffix/bar.ts': `
      export const foo: string = 'foo';
    `,
    'd.spec.ts': `
      import { foo } from 'no-star';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    './no-star-foo.ts': `
      export const foo: string = 'foo';
    `,
    'e.spec.ts': `
      import { foo } from 'longest-prefix';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    './this-is-the-longest-prefix.ts': `
      // this module should be resolved as it matches by a longer prefix
      export const foo: string = 'foo';
    `,
    './this-is-not-the-longest-prefix.ts': `
      // This module should't be resolved as it matches by a shorter prefix
      export const bar: string = 'bar';
    `,
    'f.spec.ts': `
      import { foo } from 'barfoobar';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'barfoobar.ts': `
      export const foo: string = 'foo';
    `,
    'g.spec.ts': `
      import { foo } from 'foo/[bar]';
      const { test } = pwt;
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/foo.ts': `
      export const foo: string = 'foo';
    `,
  });

  expect(result.passed).toBe(7);
  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain(`Could not`);
});
