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

import { test, expect, writeFiles } from './fixtures';

import fs from 'fs';
import path from 'path';
import url from 'url';

test.use({ mcpServerType: 'test-mcp' });

test('planner_setup_page', async ({ startClient }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ page }) => {
        await page.setContent('<button>Submit</button>');
      });
      test('template', async ({ page }) => {
      });
    `,
  });

  const { client } = await startClient();
  const response = await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'a.test.ts',
    },
  });

  expect(response).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction

### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`
`));

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
      intent: 'Click on the "Submit" button',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- button "Submit"`),
  });
});

test('planner_setup_page seed resolution', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        testDir: './tests',
      };
    `,
    'tests/seed.test.ts': `
      import { test, expect } from '@playwright/test';
      test('template', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
      });
    `,
  });

  const { client } = await startClient();

  // Relative to test dir.
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'seed.test.ts',
    },
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test.`));

  // Relative to config dir.
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'tests/seed.test.ts',
    },
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test.`));
});

test('planner_setup_page seed resolution - rootPath', async ({ startClient }) => {
  await writeFiles({
    'packages/my-app/configs/playwright.config.ts': `
      module.exports = {
        testDir: '../tests',
      };
    `,
    'packages/my-app/tests/seed.test.ts': `
      import { test, expect } from '@playwright/test';
      test('template', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
      });
    `,
  });

  const { client } = await startClient({
    args: ['--config=packages/my-app/configs/playwright.config.ts'],
    roots: [{ name: 'root', uri: url.pathToFileURL(test.info().outputPath('')).toString() }],
  });

  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'packages/my-app/tests/seed.test.ts',
    },
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test.`));
});

test('planner_setup_page with dependencies', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: /.*setup\\.ts/ },
          { name: 'chromium', dependencies: ['setup'] },
          { name: 'ignored', dependencies: ['chromium'] },
        ],
      };
    `,
    'auth.setup.ts': `
      import { test as setup, expect } from '@playwright/test';
      setup('auth', async ({ page }, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('auth.txt'), 'done');
      });
    `,
    'seed.test.ts': `
      import { test, expect } from '@playwright/test';
      test('template', async ({ page }, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('template.txt'), 'done');
      });
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'seed.test.ts',
      project: 'chromium',
    },
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));

  // Should pause at the target test, not in a dependency or any other stray project.
  expect(fs.existsSync(path.join(baseDir, 'test-results', 'auth.setup.ts-auth-setup', 'auth.txt'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'test-results', 'seed-template-chromium', 'template.txt'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'test-results', 'seed-template-ignored', 'template.txt'))).toBe(false);
});

test('planner_setup_page (loading error)', async ({ startClient }) => {
  await writeFiles({
    'seed.test.ts': `
      throw new Error('loading error');
    `,
  });
  const { client } = await startClient();
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'seed.test.ts',
    },
  })).toHaveTextResponse(expect.stringContaining('Error: loading error'));
});

test('planner_setup_page (wrong test location)', async ({ startClient }) => {
  await writeFiles({});
  const { client } = await startClient();
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'a.test.ts',
    },
  })).toEqual({
    content: [{ type: 'text', text: `Error: seed test not found.` }],
    isError: true,
  });
});

test('planner_setup_page (no test location)', async ({ startClient }) => {
  await writeFiles({});
  const { client } = await startClient();
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));
});

test('planner_setup_page chooses top-level project', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'one', testDir: './one' },
          { name: 'two', testDir: './two', dependencies: ['one'] },
        ],
      };
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));

  expect(fs.existsSync(path.join(baseDir, 'one', 'seed.spec.ts'))).toBe(false);
  expect(fs.existsSync(path.join(baseDir, 'two', 'seed.spec.ts'))).toBe(true);
});

test('planner_setup_page without location respects testsDir', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        testDir: './tests',
        projects: [{ name: 'foo' }]
      };
    `,

    'tests/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('existing', async ({ page }) => {
      });
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));

  expect(fs.existsSync(test.info().outputPath('tests', 'seed.spec.ts'))).toBe(true);
});
