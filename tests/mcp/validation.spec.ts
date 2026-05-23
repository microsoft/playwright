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

import * as z from 'zod';
import { tools } from '../../packages/playwright-core/lib/coreBundle';
import { test, expect, parseResponse } from './fixtures';

function createBackend() {
  return new tools.BrowserBackend({}, {
    once() {},
    browser: () => undefined,
  } as any, [{
    capability: 'core',
    schema: {
      name: 'browser_validate',
      title: 'Validate',
      description: 'Validate arguments',
      inputSchema: z.object({
        url: z.string(),
      }),
      type: 'action',
    },
    handle: async () => {
      throw new Error('Tool handler should not run for invalid arguments');
    },
  }]);
}

test('reports missing required tool arguments', async () => {
  const response = await createBackend().callTool('browser_validate', {});

  expect(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining('Invalid arguments for tool "browser_validate":'),
  });
  const parsed = parseResponse(response);
  expect(parsed.error).toContain('- url:');
  expect(parsed.error).toContain('string');
});

test('reports invalid tool argument types', async () => {
  const response = await createBackend().callTool('browser_validate', {
    url: 123,
  });

  const parsed = parseResponse(response);
  expect(parsed.isError).toBe(true);
  expect(parsed.error).toContain('Invalid arguments for tool "browser_validate":');
  expect(parsed.error).toContain('- url:');
  expect(parsed.error).toContain('string');
});

test('reports validation errors in json mode', async () => {
  const response = await createBackend().callTool('browser_validate', {
    _meta: { json: true },
  });

  expect(response.isError).toBe(true);
  expect(response.content[0].type).toBe('text');
  if (response.content[0].type !== 'text')
    throw new Error('Expected a text response');
  const payload = JSON.parse(response.content[0].text);
  expect(payload).toEqual(expect.objectContaining({
    isError: true,
    error: expect.stringContaining('Invalid arguments for tool "browser_validate":'),
  }));
  expect(payload.error).toContain('- url:');
  expect(payload.error).toContain('string');
});

test('reports nested tool argument paths', async () => {
  const backend = new tools.BrowserBackend({}, {
    once() {},
    browser: () => undefined,
  } as any, [{
    capability: 'core',
    schema: {
      name: 'browser_validate_nested',
      title: 'Validate nested',
      description: 'Validate nested arguments',
      inputSchema: z.object({
        items: z.array(z.object({
          label: z.string(),
        })),
      }),
      type: 'action',
    },
    handle: async () => {
      throw new Error('Tool handler should not run for invalid arguments');
    },
  }]);

  const response = await backend.callTool('browser_validate_nested', {
    items: [{ label: 123 }],
  });

  const parsed = parseResponse(response);
  expect(parsed.isError).toBe(true);
  expect(parsed.error).toContain('- items[0].label:');
  expect(parsed.error).toContain('string');
});

test('reports unknown tools before validation', async () => {
  const response = await createBackend().callTool('browser_unknown', {});

  expect(response).toHaveResponse({
    isError: true,
    error: 'Tool "browser_unknown" not found',
  });
});
