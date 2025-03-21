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

import { test, expect, retries } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test('tools list', async ({ runUITest }) => {
  const { testProcess } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        expect(1).toBe(2);
      });
    `,
  }, {
    PW_MCP: '1',
  });

  const mcp = await testProcess.attachMCP();
  const { tools } = await mcp.listTools();
  expect(tools).toEqual([
    expect.objectContaining({ name: 'listTests' }),
    expect.objectContaining({ name: 'runTests' })
  ]);
});

test('runTests', async ({ runUITest }) => {
  const { testProcess } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
      await page.setContent('<button>Submit</button>');
      expect(1).toBe(2);
      });
      `,
  }, {
    PW_MCP: '1',
  });

  const mcp = await testProcess.attachMCP();
  const listTestsResult = await mcp.callTool({ name: 'listTests' });
  const tests = JSON.parse(listTestsResult.content[0].text as string);
  expect(tests).toEqual([
    {
      id: expect.any(String),
      location: expect.any(String),
      title: 'a.test.ts >> trace test',
    },
  ]);

  const runTestsResult = await mcp.callTool({ name: 'runTests', arguments: { ids: [tests[0].id] } });
  expect(runTestsResult.content).toEqual([
    {
      type: 'text',
      text: 'Status: failed',
    },
  ]);
});
