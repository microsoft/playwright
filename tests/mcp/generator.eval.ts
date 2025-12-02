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

import { test, expect, writeFiles } from './fixtures';
import { TestServerBackend } from '../../packages/playwright/lib/mcp/test/testBackend';

test.use({ mcpHeadless: async ({ headless }, use) => use(headless) });

test('generate order-two-items', async ({ createAgent, server, headless }) => {
  await writeFiles({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
      });
    `,
    'tests/ordering/seed.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ page }) => {
        await page.goto('${server.PREFIX}/evals/fill-form.html');
      });
      test('seed test', async ({ page }) => {
      });
    `,
  });

  const agent = await createAgent(
      new TestServerBackend(test.info().outputPath('playwright.config.ts'), { headless }),
      'playwright-test-generator.agent.md',
      'generator_write_test',
      zodToJsonSchema(z.object({ code: z.string() })) as any,
  );

  const { code } = await agent.runTask(`
    Generate a test for the test plan item.
    <test-suite>Ordering Page</test-suite>
    <test-name>Order two items</test-name>
    <test-file>tests/ordering/order-two-items.spec.ts</test-file>
    <seed-file>tests/ordering/seed.spec.ts</seed-file>
    <test-data>
      Use the following details for the order form:
      - Name: John Doe
      - Address: 123 Main St, Anytown, XYZ state
      - Zip Code: 12345
      - Email: john@doe.me
    </test-data>
    <body>
      1. Fill out the form to order a blue table.
      2. Confirm the order.
      3. Verify the total price and estimated delivery for the table.
      4. Make a new order.
      5. Fill out the form to order a green desk.
      6. Confirm the order.
      7. Verify the total price and estimated delivery for the desk.
    </body>
  `, {});

  const expected = [
    `import { test, expect } from '@playwright/test';`,
    `test.beforeEach(async ({ page }) => {`,
    `  await page.goto('${server.PREFIX}/evals/fill-form.html');`,
    `});`,
    `test('Order two items', async ({ page }) => {`,
    `Fill out the form to order a blue table`,
    `await page.getByLabel('Product Type *').selectOption(['Table']);`,
    `await page.getByLabel('Color *').selectOption(['Blue']);`,
    `await page.getByRole('textbox', { name: 'Full Name *' }).fill('John Doe');`,
    `await page.getByRole('textbox', { name: 'Email Address *' }).fill('john@doe.me');`,
    `await page.getByRole('textbox', { name: 'Street Address *' }).fill('123 Main St');`,
    `await page.getByRole('textbox', { name: 'City *' }).fill('Anytown');`,
    `await page.getByRole('textbox', { name: 'State/Province *' }).fill('XYZ state');`,
    `await page.getByRole('textbox', { name: 'ZIP/Postal Code *' }).fill('12345');`,
    `Confirm the order`,
    `dialog.accept()`,
    `await page.getByRole('button', { name: 'Order' }).click();`,
    `Verify the total price and estimated delivery for the table`,
    `await expect(page.getByText('$353.98')).toBeVisible();`,
    `await expect(page.getByText('Your order will arrive in approximately 3 days')).toBeVisible();`,
    `Make a new order`,
    `await page.getByRole('button', { name: 'Place Another Order' }).click();`,
    `Fill out the form to order a green desk`,
    `await page.getByLabel('Product Type *').selectOption(['Desk']);`,
    `await page.getByLabel('Color *').selectOption(['Green']);`,
    `await page.getByRole('textbox', { name: 'Full Name *' }).fill('John Doe');`,
    `await page.getByRole('textbox', { name: 'Email Address *' }).fill('john@doe.me');`,
    `await page.getByRole('textbox', { name: 'Street Address *' }).fill('123 Main St');`,
    `await page.getByRole('textbox', { name: 'City *' }).fill('Anytown');`,
    `await page.getByRole('textbox', { name: 'State/Province *' }).fill('XYZ state');`,
    `await page.getByRole('textbox', { name: 'ZIP/Postal Code *' }).fill('12345');`,
    `Confirm the order`,
    `await page.getByRole('button', { name: 'Order' }).click();`,
    `Verify the total price and estimated delivery for the desk`,
    `await expect(page.getByText('$299.98')).toBeVisible();`,
    `await expect(page.getByText('Your order will arrive in approximately 3 days')).toBeVisible();`,
  ];

  let index = 0;
  for (const line of expected) {
    expect(code.substring(index)).toContain(line);
    index = code.indexOf(line, index) + line.length;
  }
});
