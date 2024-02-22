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
import path from 'path';

export const ctReactCliEntrypoint = path.join(__dirname, '../../packages/playwright-ct-react/cli.js');

test('should list related tests', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({});
    `,
    'helper.ts': `
      export const value = 42;
    `,
    'helper2.ts': `
      export { value } from './helper';
    `,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      import { value } from './helper2';
      if (value) {}
      test('', () => {});
    `,
    'b.spec.ts': `
      import { test } from '@playwright/test';
      import { value } from './helper';
      if (value) {}
      test('', () => {});
    `,
  }, 'find-related-test-files', ['helper.ts']);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBeFalsy();
  const data = JSON.parse(result.stdout);
  expect(data).toEqual({
    testFiles: [
      expect.stringContaining('a.spec.ts'),
      expect.stringContaining('b.spec.ts'),
    ]
  });
});

test('should list related tests for ct', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/experimental-ct-react';
      export default defineConfig({});
    `,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,
    'helper.tsx': `
      export const HelperButton = () => <button>Click me</button>;
    `,
    'button.tsx': `
      import { HelperButton } from './helper';
      export const Button = () => <HelperButton>Click me</HelperButton>;
    `,
    'button.spec.tsx': `
      import { test } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      test('foo', async ({ mount }) => {
        await mount(<Button />);
      });
    `,
  }, 'find-related-test-files', ['helper.tsx'], ctReactCliEntrypoint);
  expect(result.exitCode).toBe(0);
  const data = JSON.parse(result.stdout);
  expect(data).toEqual({
    testFiles: [
      expect.stringContaining('button.spec.tsx'),
    ]
  });
});
