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

test.describe.configure({ mode: 'parallel' });

const playwrightConfig = `
import { defineConfig } from '@playwright/experimental-ct-react';
import path from 'path';
export default defineConfig({
  use: {
    ctPort: ${3200 + (+process.env.TEST_PARALLEL_INDEX)},
  },
  projects: [{name: 'foo'}],
});
`;

test('should resolve component names using tsconfig', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@test/*": ["./src/*"],
        },
      },
    }`,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'tests/button.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from '@test/button';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
