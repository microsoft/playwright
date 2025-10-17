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

test('generator tools intent', async ({ startClient }) => {
  const { client } = await startClient();
  const { tools } = await client.listTools();
  const toolsWithIntent: string[] = [];
  for (const tool of tools) {
    if (tool.inputSchema.properties?.intent)
      toolsWithIntent.push(tool.name);
  }

  expect(toolsWithIntent).toEqual([
    'browser_close',
    'browser_resize',
    'browser_handle_dialog',
    'browser_evaluate',
    'browser_file_upload',
    'browser_fill_form',
    'browser_install',
    'browser_press_key',
    'browser_type',
    'browser_navigate',
    'browser_navigate_back',
    'browser_set_headers',
    'browser_mouse_move_xy',
    'browser_mouse_click_xy',
    'browser_mouse_drag_xy',
    'browser_click',
    'browser_drag',
    'browser_hover',
    'browser_select_option',
    'browser_tabs',
    'browser_wait_for',
    'browser_verify_element_visible',
    'browser_verify_text_visible',
    'browser_verify_list_visible',
    'browser_verify_value',
  ]);
});

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
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
      intent: 'Click submit button',
    },
  });

  expect(await client.callTool({
    name: 'generator_read_log',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`# Plan

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
\`\`\`


# Best practices
`));
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

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
      intent: 'Click submit button',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- button "Submit"`),
  });

  expect(await client.callTool({
    name: 'generator_read_log',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`# Plan

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
\`\`\`


# Best practices
`));
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
    name: 'generator_read_log',
    arguments: {},
  })).toEqual({
    content: [{ type: 'text', text: `Error: Please setup page using "generator_setup_page" first.` }],
    isError: true,
  });

  expect(await client.callTool({
    name: 'generator_write_test',
    arguments: {
      fileName: 'a.test.ts',
      code: '// Test content',
    },
  })).toEqual({
    content: [{ type: 'text', text: `Error: Please setup page using "generator_setup_page" first.` }],
    isError: true,
  });

  expect(await client.callTool({
    name: 'generator_read_log',
    arguments: {},
  })).toEqual({
    content: [{ type: 'text', text: `Error: Please setup page using "generator_setup_page" first.` }],
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

test('should respect custom test id', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        use: {
          testIdAttribute: 'data-tid'
        }
      });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ page }) => {
        await page.setContent('<button data-tid="submit">Submit</button>');
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
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
      intent: 'Click submit button',
    },
  })).toHaveResponse({
    code: `await page.getByTestId('submit').click();`,
  });
});
