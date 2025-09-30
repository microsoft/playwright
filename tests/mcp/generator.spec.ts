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

import fs from 'fs';

import { test, expect, writeFiles } from './fixtures';

test.use({ mcpServerType: 'test-mcp' });

test('generator_setup_page', async ({ startClient }) => {
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
    name: 'generator_setup_page',
    arguments: {
      plan: 'Test plan',
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

  await client.callTool({
    name: 'generator_log_step',
    arguments: {
      title: 'Click submit button',
      code: `\`\`\`ts
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\``,
    },
  });

  expect(await client.callTool({
    name: 'generator_read_log',
    arguments: {},
  })).toHaveTextResponse(`# Plan

Test plan

# Seed file: a.test.ts

\`\`\`ts


      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ page }) => {
        await page.setContent('<button>Submit</button>');
      });
      test('template', async ({ page }) => {
      });
    

\`\`\`

# Steps

### Click submit button
\`\`\`ts
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\``);
});

test('click after generator_log_action', async ({ startClient }) => {
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
  await client.callTool({
    name: 'generator_setup_page',
    arguments: {
      plan: 'Test plan',
      seedFile: 'a.test.ts',
    },
  });

  await client.callTool({
    name: 'generator_log_step',
    arguments: {
      title: 'Click submit button',
      code: `\`\`\`ts
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\``,
    },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- button "Submit"`),
  });

  expect(await client.callTool({
    name: 'generator_read_log',
    arguments: {},
  })).toHaveTextResponse(`# Plan

Test plan

# Seed file: a.test.ts

\`\`\`ts


      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ page }) => {
        await page.setContent('<button>Submit</button>');
      });
      test('template', async ({ page }) => {
      });
    

\`\`\`

# Steps

### Click submit button
\`\`\`ts
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\``);
});

test('generator_setup_page is required', async ({ startClient }) => {
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

  expect(await client.callTool({
    name: 'generator_log_step',
    arguments: {
      title: 'Click submit button',
      code: `\`\`\`ts
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\``,
    },
  })).toHaveResponse({
    result: expect.stringContaining(`Please setup page using "generator_setup_page" first.`),
    isError: true,
  });

  expect(await client.callTool({
    name: 'generator_read_log',
    arguments: {},
  })).toHaveResponse({
    result: expect.stringContaining(`Please setup page using "generator_setup_page" first.`),
    isError: true,
  });

  expect(await client.callTool({
    name: 'generator_write_test',
    arguments: {
      fileName: 'a.test.ts',
      code: '// Test content',
    },
  })).toHaveResponse({
    result: expect.stringContaining(`Please setup page using "generator_setup_page" first.`),
    isError: true,
  });
});

test('generator_write_test', async ({ startClient }, testInfo) => {
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

  await client.callTool({
    name: 'generator_setup_page',
    arguments: {
      plan: 'Test plan',
      seedFile: 'a.test.ts',
    },
  });

  expect(await client.callTool({
    name: 'generator_write_test',
    arguments: {
      fileName: 'a.test.ts',
      code: `// Test content`,
    },
  })).toHaveResponse({
    result: expect.stringContaining(`Test written to a.test.ts`),
  });

  const code = fs.readFileSync(testInfo.outputPath('a.test.ts'), 'utf8');
  expect(code).toBe(`// Test content`);
});
