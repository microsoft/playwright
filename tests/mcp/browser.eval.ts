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

import z from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { test, expect } from './fixtures';

import type * as lowireLoop from '@lowire/loop';

test.use({ mcpHeadless: async ({ headless }, use) => use(headless) });

test('fill the form', async ({ loop, client, server }) => {
  expect(await loop.run<{ price: number, deliveryDays: number }>(`
    Navigate to ${server.PREFIX + '/evals/fill-form.html'} via Playwright MCP.
    Order a blue table and a green desk.
    Use the following details for the order form:
      - Name: John Doe
      - Address: 123 Main St, Anytown, XYZ state
      - Zip Code: 12345
      - Email: john@doe.me
    Report back total price for both items, and maximum estimated delivery.
    Do not take screenshots.
  `, {
    tools: (await client.listTools()).tools as lowireLoop.Tool[],
    callTool: (params => client.callTool(params)) as lowireLoop.ToolCallback,
    resultSchema: zodToJsonSchema(z.object({
      price: z.number().describe('Total price in USD.'),
      deliveryDays: z.number().describe('Maximum estimated delivery time in days.'),
    })) as lowireLoop.Schema,
  })).toEqual({ price: 653.96, deliveryDays: 3 });
});
