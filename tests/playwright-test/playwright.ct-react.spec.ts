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

const playwrightConfig = `
  import { defineConfig } from '@playwright/experimental-ct-react';
  export default defineConfig({ projects: [{name: 'foo'}] });
`;

test('should work with TSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/button.test.tsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.jsx': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,

    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.tsx': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.tsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.jsx': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.js': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
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
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
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

test('should return root locator for fragments', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'src/button.jsx': `
      export const Button = () => <><h1>Header</h1><button>Button</button></>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toContainText('Header');
        await expect(component).toContainText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect default property values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/label.tsx': `
      export const Label = ({ checked }) => <div>type:{typeof checked} value:{String(checked)}</div>;
    `,

    'src/label.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Label } from './label';

      test('boolean shorthand', async ({ mount }) => {
        const component = await mount(<Label checked></Label>);
        await expect(component).toHaveText('type:boolean value:true');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should bundle public folder', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'public/logo.svg': `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50"/>
      </svg>`,
    'src/image.tsx': `
      export const Image = () => <img src='/logo.svg' className="App-logo" alt="logo" />;
    `,
    'src/image.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Image } from './image';

      test('pass', async ({ mount, page }) => {
        const urls = [];
        const [response] = await Promise.all([
          page.waitForResponse('**/*.svg'),
          mount(<Image></Image>)
        ]);
        const data = await response.body();
        await expect(data.toString()).toContain('</svg>');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
