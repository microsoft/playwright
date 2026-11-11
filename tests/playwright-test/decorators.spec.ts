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

test('should decorate', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44065' },
}, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {
        const pom = new POM();
        expect(pom.id).toBe('decorated');
        pom.greet();
      });

      function loggedMethod(originalMethod: any, _context: any) {
        function replacementMethod(this: any, ...args: any[]) {
          console.log('%% Entering method.');
          const result = originalMethod.call(this, ...args);
          console.log('%% Exiting method.');
          return result;
        }
        return replacementMethod;
      }

      function initializedField(_value: undefined, _context: ClassFieldDecoratorContext) {
        return () => 'decorated';
      }

      class POM {
        @initializedField
        id!: string;

        @loggedMethod
        greet() {
          console.log('%% Hello, world!');
        }
      }
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual([
    'Entering method.',
    'Hello, world!',
    'Exiting method.',
  ]);
});
