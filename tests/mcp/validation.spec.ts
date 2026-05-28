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

import { test, expect, parseResponse } from './fixtures';

test('reports missing required tool arguments', async ({ client }) => {
  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {},
  });

  expect(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining('Invalid arguments for tool "browser_navigate":'),
  });
  const parsed = parseResponse(response);
  expect(parsed.error).toContain('Invalid input: expected string');
  expect(parsed.error).toContain('at url');
});

test('reports invalid tool argument types', async ({ client }) => {
  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: 123 },
  });

  const parsed = parseResponse(response);
  expect(parsed.isError).toBe(true);
  expect(parsed.error).toContain('Invalid arguments for tool "browser_navigate":');
  expect(parsed.error).toContain('Invalid input: expected string, received number');
  expect(parsed.error).toContain('at url');
});
