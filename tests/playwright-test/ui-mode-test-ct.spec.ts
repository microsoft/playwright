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

import { test, expect, retries, dumpTestTree } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

const basicTestTree = {
  'playwright.config.ts': `
    import { defineConfig } from '@playwright/experimental-ct-react';
    export default defineConfig({
      use: {
        ctPort: ${3200 + (+process.env.TEST_PARALLEL_INDEX)}
      }  
    });
  `,
  'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
  'playwright/index.ts': ``,
  'src/button.tsx': `
    export const Button = () => <button>Button</button>;
  `,
  'src/button.test.tsx': `
    import { test, expect } from '@playwright/experimental-ct-react';
    import { Button } from './button';

    test('pass', async ({ mount }) => {
      const component = await mount(<Button></Button>);
      await expect(component).toHaveText('Button', { timeout: 1 });
    });
  `,
};

test('should run component tests', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);
  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);
});

test('should run component tests after editing test', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);
  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('fail', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button2', { timeout: 1 });
      });
    `
  });
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ fail
  `);
  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ button.test.tsx
        ❌ fail <=
  `);
});

test('should run component tests after editing component', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);
  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/button.tsx': `
      export const Button = () => <button>Button2</button>;
    `
  });
  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ button.test.tsx
        ❌ pass <=
  `);
});

test('should run component tests after editing test and component', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);
  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass 2', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button2', { timeout: 1 });
      });
    `,
    'src/button.tsx': `
      export const Button = () => <button>Button2</button>;
    `
  });
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass 2
  `);

  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass 2
  `);
});

test('should watch test', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);

  await page.getByTitle('Watch all').click();
  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button2', { timeout: 1 });
      });
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ button.test.tsx
        ❌ pass <=
  `);
});

test('should watch component', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);

  await page.getByTitle('Watch all').click();
  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/button.tsx': `
      export const Button = () => <button>Button2</button>;
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ button.test.tsx
        ❌ pass <=
  `);
});

test('should watch component via util', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    ...basicTestTree,
    'src/button.tsx': undefined,
    'src/button.ts': `
      import { Button } from './buttonComponent';
      export { Button };
    `,
    'src/buttonComponent.tsx': `
      export const Button = () => <button>Button</button>;
    `,
  });
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);

  await page.getByTitle('Watch all').click();
  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/buttonComponent.tsx': `
      export const Button = () => <button>Button2</button>;
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ button.test.tsx
        ❌ pass <=
  `);
});

test('should watch component when editing util', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    ...basicTestTree,
    'src/button.tsx': undefined,
    'src/button.ts': `
      import { Button } from './buttonComponent';
      export { Button };
    `,
    'src/buttonComponent.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/buttonComponent2.tsx': `
      export const Button = () => <button>Button2</button>;
    `,
  });
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ button.test.tsx
        ◯ pass
  `);

  await page.getByTitle('Watch all').click();
  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ button.test.tsx
        ✅ pass
  `);

  await writeFiles({
    'src/button.ts': `
      import { Button } from './buttonComponent2';
      export { Button };
    `,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ button.test.tsx
        ❌ pass <=
  `);
});
