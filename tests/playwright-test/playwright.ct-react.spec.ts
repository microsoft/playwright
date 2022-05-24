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

test('should work with TSX', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test.fixme('should work with JSX', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': ``,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test.fixme('should work with JS in JSX', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': ``,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
