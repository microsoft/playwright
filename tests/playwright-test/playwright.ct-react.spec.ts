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

test('should work with TSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,
    'src/button.tsx': `
      //@no-header
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

test('should work with JSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': `
      //@no-header
    `,

    'src/button.jsx': `
      //@no-header
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

test('should work with JSX in JS', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': `
      //@no-header
    `,

    'src/button.js': `
      //@no-header
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

test('should work with JSX in JS and in JSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': `
      //@no-header
    `,

    'src/button.js': `
      //@no-header
      export const Button = () => <button>Button</button>;
    `,

    'src/list.jsx': `
      //@no-header
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });

      test('pass list', async ({ mount }) => {
        const component = await mount(<List></List>);
        await expect(component).toHaveText('List');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});


test('should work with stray TSX import', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/button.tsx': `
      //@no-header
      export const Button = () => <button>Button</button>;
    `,

    'src/list.tsx': `
      //@no-header
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with stray JSX import', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': `
      //@no-header
    `,

    'src/button.jsx': `
      //@no-header
      export const Button = () => <button>Button</button>;
    `,

    'src/list.jsx': `
      //@no-header
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test.fixme('should work with stray JS import', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': `
      //@no-header
    `,

    'src/button.js': `
      //@no-header
      export const Button = () => <button>Button</button>;
    `,

    'src/list.js': `
      //@no-header
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with JSX in variable', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.js"></script>`,
    'playwright/index.js': `
      //@no-header
    `,

    'src/button.jsx': `
      //@no-header
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      const button = <Button></Button>;

      test('pass button', async ({ mount }) => {
        const component = await mount(button);
        await expect(component).toHaveText('Button'); 
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
