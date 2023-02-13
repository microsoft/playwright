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
