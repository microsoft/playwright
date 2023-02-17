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
import fs from 'fs';

test.describe.configure({ mode: 'parallel' });

const playwrightConfig = `
  import { defineConfig } from '@playwright/experimental-ct-react';
  export default defineConfig({ projects: [{name: 'foo'}] });
`;

test('should work with the empty component list', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'a.test.ts': `
      import { test, expect } from '@playwright/experimental-ct-react';
      test('pass', async ({ mount }) => {});
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const output = result.output;
  expect(output).toContain('transforming...');
  expect(output.replace(/\\+/g, '/')).toContain('playwright/.cache/playwright/index.html');

  const metainfo = JSON.parse(fs.readFileSync(testInfo.outputPath('playwright/.cache/metainfo.json'), 'utf-8'));
  expect(metainfo.version).toEqual(require('playwright-core/package.json').version);
  expect(metainfo.viteVersion).toEqual(require('vite/package.json').version);
  expect(Object.entries(metainfo.tests)).toHaveLength(1);
  expect(Object.entries(metainfo.sources)).toHaveLength(8);
});

test('should extract component list', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,

    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/components.tsx': `
      export const Component1 = () => <div>Component 1</div>;
      export const Component2 = () => <div>Component 2</div>;
    `,

    'src/defaultExport.tsx': `
      export default () => <div>Default export</div>;
    `,

    'src/clashingNames1.tsx': `
      export const ClashingName = () => <div>Clashing name 1</div>;
    `,

    'src/clashingNames2.tsx': `
      export const ClashingName = () => <div>Clashing name 2</div>;
    `,

    'src/one-import.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,

    'src/named-imports.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Component1, Component2 } from './components';

      test('pass 1', async ({ mount }) => {
        const component = await mount(<Component1></Component1>);
        await expect(component).toHaveText('Component 1');
      });

      test('pass 2', async ({ mount }) => {
        const component = await mount(<Component2></Component2>);
        await expect(component).toHaveText('Component 2');
      });
    `,

    'src/default-import.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import DefaultComponent from './defaultExport';

      test('named', async ({ mount }) => {
        const component = await mount(<DefaultComponent></DefaultComponent>);
        await expect(component).toHaveText('Default export');
      });
    `,

    'src/clashing-imports.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';

      import DefaultComponent from './defaultExport.tsx';
      import { ClashingName as CN1 } from './clashingNames1';
      import { ClashingName as CN2 } from './clashingNames2';

      test('named', async ({ mount }) => {
        const component = await mount(<CN1></CN1>);
        await expect(component).toHaveText('Clashing name 1');
      });

      test('pass 2', async ({ mount }) => {
        const component = await mount(<CN2></CN2>);
        await expect(component).toHaveText('Clashing name 2');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);

  const metainfo = JSON.parse(fs.readFileSync(testInfo.outputPath('playwright/.cache/metainfo.json'), 'utf-8'));
  metainfo.components.sort((a, b) => {
    return (a.importPath + '/' + a.importedName).localeCompare(b.importPath + '/' + b.importedName);
  });

  expect(metainfo.components).toEqual([{
    fullName: expect.stringContaining('playwright_test_src_button_tsx_Button'),
    importedName: 'Button',
    importPath: expect.stringContaining('button.tsx'),
    isModuleOrAlias: false
  }, {
    fullName: expect.stringContaining('playwright_test_src_clashingNames1_tsx_ClashingName'),
    importedName: 'ClashingName',
    importPath: expect.stringContaining('clashingNames1.tsx'),
    isModuleOrAlias: false
  }, {
    fullName: expect.stringContaining('playwright_test_src_clashingNames2_tsx_ClashingName'),
    importedName: 'ClashingName',
    importPath: expect.stringContaining('clashingNames2.tsx'),
    isModuleOrAlias: false
  }, {
    fullName: expect.stringContaining('playwright_test_src_components_tsx_Component1'),
    importedName: 'Component1',
    importPath: expect.stringContaining('components.tsx'),
    isModuleOrAlias: false
  }, {
    fullName: expect.stringContaining('playwright_test_src_components_tsx_Component2'),
    importedName: 'Component2',
    importPath: expect.stringContaining('components.tsx'),
    isModuleOrAlias: false
  }, {
    fullName: expect.stringContaining('playwright_test_src_defaultExport_tsx'),
    importPath: expect.stringContaining('defaultExport.tsx'),
    isModuleOrAlias: false
  }]);

  for (const [file, test] of Object.entries(metainfo.tests)) {
    if (file.endsWith('clashing-imports.spec.tsx')) {
      expect(test).toEqual({
        timestamp: expect.any(Number),
        components: [
          expect.stringContaining('clashingNames1_tsx_ClashingName'),
          expect.stringContaining('clashingNames2_tsx_ClashingName'),
        ],
        deps: [
          expect.stringContaining('clashingNames1.tsx'),
          expect.stringContaining('clashingNames2.tsx'),
        ],
      });
    }
    if (file.endsWith('default-import.spec.tsx')) {
      expect(test).toEqual({
        timestamp: expect.any(Number),
        components: [
          expect.stringContaining('defaultExport_tsx'),
        ],
        deps: [
          expect.stringContaining('defaultExport.tsx'),
        ]
      });
    }
    if (file.endsWith('named-imports.spec.tsx')) {
      expect(test).toEqual({
        timestamp: expect.any(Number),
        components: [
          expect.stringContaining('components_tsx_Component1'),
          expect.stringContaining('components_tsx_Component2'),
        ],
        deps: [
          expect.stringContaining('components.tsx'),
        ]
      });
    }
    if (file.endsWith('one-import.spec.tsx')) {
      expect(test).toEqual({
        timestamp: expect.any(Number),
        components: [
          expect.stringContaining('button_tsx_Button'),
        ],
        deps: [
          expect.stringContaining('button.tsx'),
        ]
      });
    }
  }
});

test('should cache build', async ({ runInlineTest }, testInfo) => {
  test.slow();

  await test.step('original test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
      'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
      'playwright/index.ts': ``,

      'src/button.tsx': `
        export const Button = () => <button>Button</button>;
      `,

      'src/button.test.tsx': `
          import { test, expect } from '@playwright/experimental-ct-react';
        import { Button } from './button.tsx';

        test('pass', async ({ mount }) => {
          const component = await mount(<Button></Button>);
          await expect(component).toHaveText('Button');
        });
      `,
    }, { workers: 1 });

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output, 'should rebuild bundle').toContain('modules transformed');
  });

  await test.step('re-run same test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
    }, { workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output, 'should not rebuild bundle').not.toContain('modules transformed');
  });

  await test.step('modify test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
      'src/button.test.tsx': `
          import { test, expect } from '@playwright/experimental-ct-react';
        import { Button } from './button.tsx';

        test('pass updated', async ({ mount }) => {
          const component = await mount(<Button></Button>);
          await expect(component).toHaveText('Button 2', { timeout: 200 });
        });
      `,
    }, { workers: 1 });
    expect(result.exitCode).toBe(1);
    expect(result.passed).toBe(0);
    const output = result.output;
    expect(output, 'should not rebuild bundle').not.toContain('modules transformed');
  });

  await test.step('modify source', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
      'src/button.tsx': `
        export const Button = () => <button>Button 2</button>;
      `,
    }, { workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output, 'should rebuild bundle').toContain('modules transformed');
  });
});

test('should grow cache', async ({ runInlineTest }, testInfo) => {
  test.slow();

  await test.step('original test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
      'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
      'playwright/index.ts': ``,
      'src/button1.tsx': `
        export const Button1 = () => <button>Button 1</button>;
      `,
      'src/button2.tsx': `
        export const Button2 = () => <button>Button 2</button>;
      `,
      'src/button1.test.tsx': `
          import { test, expect } from '@playwright/experimental-ct-react';
        import { Button1 } from './button1.tsx';
        test('pass', async ({ mount }) => {
          const component = await mount(<Button1></Button1>);
          await expect(component).toHaveText('Button 1');
        });
      `,
      'src/button2.test.tsx': `
          import { test, expect } from '@playwright/experimental-ct-react';
        import { Button2 } from './button2.tsx';
        test('pass', async ({ mount }) => {
          const component = await mount(<Button2></Button2>);
          await expect(component).toHaveText('Button 2');
        });
      `,
    }, { workers: 1 }, undefined, { additionalArgs: ['button1'] });

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output).toContain('modules transformed');
  });

  await test.step('run second test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
    }, { workers: 1 }, undefined, { additionalArgs: ['button2'] });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output).toContain('modules transformed');
  });

  await test.step('run first test again', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightConfig,
    }, { workers: 1 }, undefined, { additionalArgs: ['button2'] });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output).not.toContain('modules transformed');
  });
});

test('should not use global config for preview', async ({ runInlineTest }) => {
  const result1 = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,
    'vite.config.js': `
      export default {
        plugins: [{
          configurePreviewServer: () => {
            throw new Error('Original preview throws');
          }
        }]
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/experimental-ct-react';
      test('pass', async ({ mount }) => {});
    `,
  }, { workers: 1 });
  expect(result1.exitCode).toBe(0);
  expect(result1.passed).toBe(1);

  const result2 = await runInlineTest({
    'playwright.config.ts': playwrightConfig,
  }, { workers: 1 });
  expect(result2.exitCode).toBe(0);
  expect(result2.passed).toBe(1);
});

test('should work with https enabled', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,
    'playwright.config.js': `
      import { defineConfig } from '@playwright/experimental-ct-react';
      import basicSsl from '@vitejs/plugin-basic-ssl';
      export default defineConfig({
        use: {
          ignoreHTTPSErrors: true,
          ctViteConfig: {
            plugins: [basicSsl()],
            preview: {
              https: true
            }
          }
        },
      });
    `,
    'http.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';

      test('pass', async ({ page }) => {
        await expect(page).toHaveURL(/https:.*/);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
