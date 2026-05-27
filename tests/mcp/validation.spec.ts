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

test('reports validation errors in json mode', async ({ client }) => {
  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      _meta: { json: true },
    },
  });

  expect(response.isError).toBe(true);
  expect(response.content[0].type).toBe('text');
  if (response.content[0].type !== 'text')
    throw new Error('Expected a text response');
  const payload = JSON.parse(response.content[0].text);
  expect(payload).toEqual(expect.objectContaining({
    isError: true,
    error: expect.stringContaining('Invalid arguments for tool "browser_navigate":'),
  }));
  expect(payload.error).toContain('Invalid input: expected string');
  expect(payload.error).toContain('at url');
});

test('reports nested tool argument paths', async ({ client }) => {
  const response = await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [{
        target: 'e1',
        name: 'Name',
        type: 'textbox',
        value: 123,
      }],
    },
  });

  const parsed = parseResponse(response);
  expect(parsed.isError).toBe(true);
  expect(parsed.error).toContain('Invalid arguments for tool "browser_fill_form":');
  expect(parsed.error).toContain('Invalid input: expected string, received number');
  expect(parsed.error).toContain('at fields[0].value');
});
