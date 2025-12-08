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

import { test, expect } from './pageTest';
import z from 'zod';

test('page.perform', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/evals/fill-form.html');
  await page.perform('Fill out the form with the following details:\n' +
    'Name: John Smith\n' +
    'Address: 1045 La Avenida St, Mountain View, CA 94043\n' +
    'Email: john.smith@at-microsoft.com');
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - textbox "Full Name *": John Smith
    - textbox "Email Address *": john.smith@at-microsoft.com
    - textbox "Street Address *": 1045 La Avenida St
    - textbox "City *": Mountain View
    - textbox "State/Province *": CA
    - textbox "ZIP/Postal Code *": 94043
  `);
});

test.skip('extract task', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  await page.perform('Add "Buy groceries" todo');
  console.log(await page.extract('List todos with their statuses', z.object({
    items: z.object({
      title: z.string(),
      completed: z.boolean()
    }).array()
  })));
});
