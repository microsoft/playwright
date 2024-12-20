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

test('globalSetup and globalTeardown should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'dir/playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        testDir: '..',
        globalSetup: './globalSetup',
        globalTeardown: path.join(__dirname, 'globalTeardown.ts'),
        projects: [{ name: 'p1' }]
      };
    `,
    'dir/globalSetup.ts': `
      module.exports = async () => {
        console.log('\\n%%from-global-setup');
      };
    `,
    'dir/globalTeardown.ts': `
      module.exports = async () => {
        console.log('\\n%%from-global-teardown');
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}, testInfo) => {
        console.log('\\n%%from-test');
      });
    `,
  }, { 'config': 'dir' });
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.outputLines).toEqual([
    'from-global-setup',
    'from-test',
    'from-global-teardown',
  ]);
});

test('standalone globalTeardown should work', async ({ runInlineTest }) => {
  const { results, output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalTeardown: './globalTeardown.ts',
      };
    `,
    'globalTeardown.ts': `
      module.exports = async () => {
        console.log('got my teardown');
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}, testInfo) => {
      });
    `,
  });
  expect(results[0].status).toBe('passed');
  expect(output).toContain('got my teardown');
});

test('globalTeardown runs after failures', async ({ runInlineTest }) => {
  const { results, output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'globalSetup.ts',
        globalTeardown: './globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        await new Promise(f => setTimeout(f, 100));
        global.value = 42;
        process.env.FOO = String(global.value);
      };
    `,
    'globalTeardown.ts': `
      module.exports = async () => {
        console.log('teardown=' + global.value);
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}, testInfo) => {
        expect(process.env.FOO).toBe('43');
      });
    `,
  });
  expect(results[0].status).toBe('failed');
  expect(output).toContain('teardown=42');
});

test('globalTeardown still runs when globalSetup times out', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: './globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
        globalTimeout: 1000,
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        await new Promise(f => setTimeout(f, 10000));
      };
    `,
    'globalTeardown.ts': `
      module.exports = async () => {
        console.log('teardown=');
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should not run', async ({}, testInfo) => {
      });
    `,
  });
  expect(result.output).toContain('Timed out waiting 1s for the global setup to run');
  expect(result.output).toContain('teardown=');
});

test('globalSetup should work with sync function', async ({ runInlineTest }) => {
  const { passed } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: './globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = () => {
        process.env.FOO = JSON.stringify({ foo: 'bar' });
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {
        const value = JSON.parse(process.env.FOO);
        expect(value).toEqual({ foo: 'bar' });
      });
    `,
  });
  expect(passed).toBe(1);
});

test('globalSetup error should prevent tests from executing', async ({ runInlineTest }) => {
  const { passed, output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: './globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = () => {
        throw new Error('failure in global setup!');
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('a', async ({}) => {
        console.log('this test ran');
      });

      test('b', async ({}) => {
        console.log('this test ran');
      });
    `,
  }, { reporter: 'line' });

  expect(output).not.toContain('this test ran');
  expect(passed).toBe(0);
});

test('globalSetup should throw when passed non-function', async ({ runInlineTest }) => {
  const { output } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: './globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = 42;
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {
      });
    `,
  });
  expect(output).toContain(`globalSetup.ts: file must export a single function.`);
});

test('globalSetup should work with default export and run the returned fn', async ({ runInlineTest }) => {
  const { output, exitCode, passed } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: './globalSetup.ts',
      };
    `,
    'globalSetup.ts': `
      function setup() {
        let x = 42;
        console.log('\\n%%setup: ' + x);
        return async () => {
          await x;
          console.log('\\n%%teardown: ' + x);
        };
      }
      export default setup;
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {
      });
    `,
  });
  expect(passed).toBe(1);
  expect(exitCode).toBe(0);
  expect(output).toContain(`%%setup: 42`);
  expect(output).toContain(`%%teardown: 42`);
});

test('globalSetup should allow requiring a package from node_modules', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: 'my-global-setup'
      };
    `,
    'node_modules/my-global-setup/index.js': `
      module.exports = async () => {
        await new Promise(f => setTimeout(f, 100));
        global.value = 42;
        process.env.FOO = String(global.value);
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}, testInfo) => {
        expect(process.env.FOO).toBe('42');
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

const authFiles = {
  'playwright.config.ts': `
    import { PlaywrightTestConfig } from '@playwright/test';
    const config: PlaywrightTestConfig = {
      globalSetup: require.resolve('./auth'),
      use: {
        baseURL: 'https://www.example.com',
        storageState: 'state.json',
      },
    };
    export default config;
  `,
  'auth.ts': `
    import { chromium, FullConfig } from '@playwright/test';
    async function globalSetup(config: FullConfig) {
      const { baseURL, storageState } = config.projects[0].use;
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.route('**/*', route => {
        route.fulfill({ body: '<html></html>' }).catch(() => {});
      });
      await page.goto(baseURL!);
      await page.evaluate(() => {
        localStorage['name'] = 'value';
      });
      await page.context().storageState({ path: storageState as string });
      await browser.close();
    };
    export default globalSetup;
  `,
  'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('should have storage state', async ({ page }) => {
      await page.route('**/*', route => {
        route.fulfill({ body: '<html></html>' }).catch(() => {});
      });
      await page.goto('/');
      const value = await page.evaluate(() => localStorage['name']);
      expect(value).toBe('value');
    });
  `,
};

test('globalSetup should work for auth', async ({ runInlineTest }) => {
  const result = await runInlineTest(authFiles);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('globalSetup auth should compile', async ({ runTSC }) => {
  const result = await runTSC(authFiles);
  expect(result.exitCode).toBe(0);
});

test('teardown order', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      const plugins = [];
      for (let i = 1; i < 4; ++i) {
        plugins.push(() => ({
          setup: () => console.log('\\n%%setup ' + i),
          teardown: () => console.log('\\n%%teardown ' + i),
        }));
      }
      export default { '@playwright/test': { plugins } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual([
    'setup 1',
    'setup 2',
    'setup 3',
    'teardown 3',
    'teardown 2',
    'teardown 1',
  ]);
});

test('teardown after error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      const plugins = [];
      for (let i = 1; i < 4; ++i) {
        plugins.push(() => ({
          setup: () => console.log('\\n%%setup ' + i),
          teardown: () => {
            console.log('\\n%%teardown ' + i);
            throw new Error('failed teardown ' + i)
          },
        }));
      }
      export default { '@playwright/test': { plugins } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  const output = result.output;
  expect(output).toContain('Error: failed teardown 1');
  expect(output).toContain('Error: failed teardown 2');
  expect(output).toContain('Error: failed teardown 3');
  expect(output).toContain('throw new Error(\'failed teardown');
  expect(result.outputLines).toEqual([
    'setup 1',
    'setup 2',
    'setup 3',
    'teardown 3',
    'teardown 2',
    'teardown 1',
  ]);
});

test('globalSetup should support multiple', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        globalSetup: ['./globalSetup1.ts','./globalSetup2.ts','./globalSetup3.ts','./globalSetup4.ts'],
        globalTeardown: ['./globalTeardown1.ts', './globalTeardown2.ts'],
      };
    `,
    'globalSetup1.ts': `module.exports = () => { console.log('%%globalSetup1'); return () => { console.log('%%callback1'); throw new Error('kaboom'); } };`,
    'globalSetup2.ts': `module.exports = () => console.log('%%globalSetup2');`,
    'globalSetup3.ts': `module.exports = () => { console.log('%%globalSetup3'); return () => console.log('%%callback3'); }`,
    'globalSetup4.ts': `module.exports = () => console.log('%%globalSetup4');`,
    'globalTeardown1.ts': `module.exports = () => console.log('%%globalTeardown1')`,
    'globalTeardown2.ts': `module.exports = () => { console.log('%%globalTeardown2'); throw new Error('kaboom'); }`,

    'a.test.js': `
      import { test } from '@playwright/test';
      test('a', () => console.log('%%test a'));
      test('b', () => console.log('%%test b'));
    `,
  }, { reporter: 'line' });
  expect(result.passed).toBe(2);

  // first setups, then setup callbacks in reverse order.
  // then teardowns in declared order.
  expect(result.outputLines).toEqual([
    'globalSetup1',
    'globalSetup2',
    'globalSetup3',
    'globalSetup4',
    'test a',
    'test b',
    'callback3',
    'callback1',
    'globalTeardown1',
    'globalTeardown2',
  ]);
  expect(result.output).toContain('Error: kaboom');
});

test('globalTeardown runs even if callback failed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        globalSetup: './globalSetup.ts',
        globalTeardown: './globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `module.exports = () => { console.log('%%globalSetup'); return () => { throw new Error('kaboom'); } };`,
    'globalTeardown.ts': `module.exports = () => console.log('%%globalTeardown')`,

    'a.test.js': `
      import { test } from '@playwright/test';
      test('a', () => console.log('%%test'));
    `,
  }, { reporter: 'line' });
  expect(result.passed).toBe(1);

  // first setups, then setup callbacks in reverse order.
  // then teardowns in declared order.
  expect(result.outputLines).toEqual([
    'globalSetup',
    'test',
    'globalTeardown',
  ]);
  expect(result.output).toContain('Error: kaboom');
});
