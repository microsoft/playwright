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

import { test, expect, playwrightCtConfigText } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';

test.describe.configure({ mode: 'parallel' });

test('should work with the empty component list', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
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
  expect(output.replace(/\\+/g, '/')).toContain('.cache/index.html');

  const metainfo = JSON.parse(fs.readFileSync(testInfo.outputPath('playwright/.cache/metainfo.json'), 'utf-8'));
  expect(metainfo.version).toEqual(require('playwright-core/package.json').version);
  expect(metainfo.viteVersion).toEqual(require('vite/package.json').version);
  expect(Object.entries(metainfo.deps)).toHaveLength(0);
  expect(Object.entries(metainfo.sources)).toHaveLength(9);
});

test('should extract component list', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
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
    'src/relative-import-different-folders/one/index.tsx': `
      export default () => <button>Button</button>;
    `,
    'src/relative-import-different-folders/one/one.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import Button from '.';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
    'src/relative-import-different-folders/two/index.tsx': `
      export default () => <button>Button</button>;
    `,
    'src/relative-import-different-folders/two/two.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import Button from '.';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);

  const metainfo = JSON.parse(fs.readFileSync(testInfo.outputPath('playwright/.cache/metainfo.json'), 'utf-8'));
  metainfo.components.sort((a, b) => {
    return (a.importSource + '/' + a.importedName).localeCompare(b.importSource + '/' + b.importedName);
  });

  expect(metainfo.components).toEqual([{
    id: expect.stringContaining('button_Button'),
    remoteName: 'Button',
    importSource: expect.stringContaining('./button'),
    filename: expect.stringContaining('one-import.spec.tsx'),
  }, {
    id: expect.stringContaining('clashingNames1_ClashingName'),
    remoteName: 'ClashingName',
    importSource: expect.stringContaining('./clashingNames1'),
    filename: expect.stringContaining('clashing-imports.spec.tsx'),
  }, {
    id: expect.stringContaining('clashingNames2_ClashingName'),
    remoteName: 'ClashingName',
    importSource: expect.stringContaining('./clashingNames2'),
    filename: expect.stringContaining('clashing-imports.spec.tsx'),
  }, {
    id: expect.stringContaining('components_Component1'),
    remoteName: 'Component1',
    importSource: expect.stringContaining('./components'),
    filename: expect.stringContaining('named-imports.spec.tsx'),
  }, {
    id: expect.stringContaining('components_Component2'),
    remoteName: 'Component2',
    importSource: expect.stringContaining('./components'),
    filename: expect.stringContaining('named-imports.spec.tsx'),
  }, {
    id: expect.stringContaining('defaultExport'),
    importSource: expect.stringContaining('./defaultExport'),
    filename: expect.stringContaining('default-import.spec.tsx'),
  }, {
    id: expect.stringContaining('_one'),
    importSource: expect.stringContaining('.'),
    filename: expect.stringContaining(`one${path.sep}one.spec.tsx`),
  }, {
    id: expect.stringContaining('_two'),
    importSource: expect.stringContaining('.'),
    filename: expect.stringContaining(`two${path.sep}two.spec.tsx`),
  }]);

  for (const [, value] of Object.entries(metainfo.deps))
    (value as string[]).sort();

  expect(Object.entries(metainfo.deps)).toEqual([
    [expect.stringContaining('clashingNames1.tsx'), [
      expect.stringContaining('clashingNames1.tsx'),
    ]],
    [expect.stringContaining('clashingNames2.tsx'), [
      expect.stringContaining('clashingNames2.tsx'),
    ]],
    [expect.stringContaining('defaultExport.tsx'), [
      expect.stringContaining('defaultExport.tsx'),
    ]],
    [expect.stringContaining('components.tsx'), [
      expect.stringContaining('components.tsx'),
    ]],
    [expect.stringContaining('button.tsx'), [
      expect.stringContaining('button.tsx'),
    ]],
    [expect.stringContaining(`one${path.sep}index.tsx`), [
      expect.stringContaining(`one${path.sep}index.tsx`),
    ]],
    [expect.stringContaining(`two${path.sep}index.tsx`), [
      expect.stringContaining(`two${path.sep}index.tsx`),
    ]],
  ]);
});

test('should cache build', async ({ runInlineTest }, testInfo) => {
  test.slow();

  await test.step('original test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightCtConfigText,
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
      'playwright.config.ts': playwrightCtConfigText,
    }, { workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output, 'should not rebuild bundle').not.toContain('modules transformed');
  });

  await test.step('modify test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightCtConfigText,
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
      'playwright.config.ts': playwrightCtConfigText,
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
      'playwright.config.ts': playwrightCtConfigText,
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
      'playwright.config.ts': playwrightCtConfigText,
    }, { workers: 1 }, undefined, { additionalArgs: ['button2'] });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output).toContain('modules transformed');
  });

  await test.step('run first test again', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightCtConfigText,
    }, { workers: 1 }, undefined, { additionalArgs: ['button2'] });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output).not.toContain('modules transformed');
  });
});

test('should not use global config for preview', async ({ runInlineTest }) => {
  const result1 = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
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
    'playwright.config.ts': playwrightCtConfigText,
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

test('list compilation cache should not clash with the run one', async ({ runInlineTest }) => {
  const listResult = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/button.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 }, {}, { additionalArgs: ['--list'] });
  expect(listResult.exitCode).toBe(0);
  expect(listResult.passed).toBe(0);

  const runResult = await runInlineTest({}, { workers: 1 });
  expect(runResult.exitCode).toBe(0);
  expect(runResult.passed).toBe(1);
});

test('should retain deps when test changes', async ({ runInlineTest }, testInfo) => {
  test.slow();

  await test.step('original test', async () => {
    const result = await runInlineTest({
      'playwright.config.ts': playwrightCtConfigText,
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
    expect(output).toContain('modules transformed');
  });

  await test.step('modify test and run it again', async () => {
    const result = await runInlineTest({
      'src/button.test.tsx': `
        import { test, expect } from '@playwright/experimental-ct-react';
        import { Button } from './button.tsx';
        test('pass', async ({ mount }) => {
          const component1 = await mount(<Button></Button>);
          await expect(component1).toHaveText('Button');
        });
      `,
    }, { workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    const output = result.output;
    expect(output).not.toContain('modules transformed');
  });

  const metainfo = JSON.parse(fs.readFileSync(testInfo.outputPath('playwright/.cache/metainfo.json'), 'utf-8'));

  expect(metainfo.components).toEqual([{
    id: expect.stringContaining('button_tsx_Button'),
    remoteName: 'Button',
    importSource: expect.stringContaining('button.tsx'),
    filename: expect.stringContaining('button.test.tsx'),
  }]);

  for (const [, value] of Object.entries(metainfo.deps))
    (value as string[]).sort();

  expect(Object.entries(metainfo.deps)).toEqual([
    [
      expect.stringContaining('button.tsx'),
      [
        expect.stringContaining('button.tsx'),
      ],
    ]
  ]);
});

test('should render component via re-export', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/buttonHelper.ts': `
      import { Button } from './button.tsx';
      export { Button };
    `,
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './buttonHelper';
      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should import json', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/some.json': `{ "some": "value" }`,
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import json from './some.json';
      test('pass', async ({}) => {
        expect(json.some).toBe('value');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should render component exported via fixture', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/buttonFixture.tsx': `
      import { Button } from './button';
      import { test as baseTest } from '@playwright/experimental-ct-react';
      export { expect } from '@playwright/experimental-ct-react';
      export const test = baseTest.extend({
        button: async ({ mount }, use) => {
          await use(await mount(<Button></Button>));
        }
      });
    `,
    'src/button.test.tsx': `
      import { test, expect } from './buttonFixture';
      test('pass', async ({ button }) => {
        await expect(button).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should pass imported images from test to component', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/image.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAQAAAD9CzEMAAACMElEQVRYw+1XT0tCQRD/9Qci0Cw7mp1C6BMYnt5niMhPEEFCh07evNk54XnuGkhFehA/QxHkqYMEFWXpscMTipri7fqeu+vbfY+EoBkQ3Zn5zTo7MzsL/NNfoClkUUQNN3jCJ/ETfavRSpYkkSmFQzz8wMr4gaSp8OBJ2HCU4Iwd0kqGgd9GPxCccZ+0jWgWVW1wxlWy0qR51I3hv7lOllq7b4SC/+aGzr+QBadjEKgAykvzJGXwr/Lj4JfRk5hUSLKIa00HPUJRki0xeMWSWxVXmi5sddXKymqTyxdwquXAUVV3WREeLx3gTcNFWQY/jXtB8QIzgt4qTvAR4OCe0ATKCmrnmFMEM0Pp2BvrIisaFUdUjgKKZgYWSjjDLR5J+x13lATHuHSti6JBzQP+gq2QHXjfRaiJojbPgYqbmGFow0VpiyIW0/VIF9QKLzeBWA2MHmwCu8QJQV++Ps/joHQQH4HpuO0uobUeVztgIcr4Vnf4we9orWfUIWKHbEVyYKkPmaVpIVKICuo0ZYXWjHTITXWhsVYxkIDpUoKsla1i2Oz2QjvYG9fshu36GbFQ8DGyHNOuvRdOKZSDUtCFM7wyHeSM4XN8e7bOpd9F2gg+TRYal753bGkbuEjzMg0YW/yDV1czUDm+e43Byz86OnRwsYDMKXlmkYbeAOwffrtU/nGpXpwkXfPhVza+D9AiMAtrtOMYfVr0q8Wr1nh8n8ADZCJPqAk8AifyjP2n36cvkA6/Wln9MokAAAAASUVORK5CYII=', 'base64'),
    'src/image.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import imageSrc from './image.png';
      test('pass', async ({ mount }) => {
        const component = await mount(<img src={imageSrc}></img>);
        await expect(component).toHaveJSProperty('naturalWidth', 48);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should pass dates, regex, urls and bigints', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/button.tsx': `
      export const Button = ({ props }: any) => {
        const { date, url, bigint, regex } = props;
        const types = [
          date instanceof Date,
          url instanceof URL,
          typeof bigint === 'bigint',
          regex instanceof RegExp,
        ];
        return <div>{types.join(' ')}</div>;
      };
    `,
    'src/component.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('renders props with builtin types', async ({ mount, page }) => {
        const component = await mount(<Button props={{
          date: new Date(),
          url: new URL('https://example.com'),
          bigint: BigInt(42),
          regex: /foo/,
        }} />);
        await expect(component).toHaveText('true true true true');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should pass undefined value as param', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/component.tsx': `
      export const Component = ({ value }: { value?: number }) => {
        return <div>{typeof value}</div>;
      };
    `,
    'src/component.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Component } from './component';

      test('renders props with undefined type', async ({ mount, page }) => {
        const component = await mount(<Component value={undefined} />);
        await expect(component).toHaveText('undefined');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should resolve components imported from node_modules', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "name": "test-project" }`,
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'node_modules/@mui/material/index.js': `
      const TextField = () => 'input';
      module.exports = { TextField };
    `,
    'node_modules/@mui/material/package.json': JSON.stringify({
      name: '@mui/material',
      main: './index.js',
    }),

    'src/component.spec.tsx': `
      import { test } from '@playwright/experimental-ct-react';
      import { TextField } from '@mui/material';

      test("passes", async ({ mount }) => {
        await mount(<TextField />);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
