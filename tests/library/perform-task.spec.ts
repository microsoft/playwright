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

import { browserTest as test, expect } from '../config/browserTest';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
    secrets: {
      'x-secret-email': 'secret-email@at-microsoft.com',
    }
  }
});

test('page.perform', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/evals/fill-form.html');
  page.on('agentturn', turn => {
    // For debugging purposes it is on for now.
    console.log('agentturn', turn);
  });
  await page.agent.perform('Fill out the form with the following details:\n' +
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

test('page.perform secret', async ({ page, server }) => {
  await page.setContent('<input type="email" name="email" placeholder="Email Address"/>');
  await page.agent.perform('Enter x-secret-email into the email field');
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - textbox "Email Address": secret-email@at-microsoft.com
  `);
});

test.skip('extract task', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  await page.agent.perform('Add "Buy groceries" todo');
  console.log(await page.agent.extract('List todos with their statuses', z.object({
    items: z.object({
      title: z.string(),
      completed: z.boolean()
    }).array()
  })));
});

test('page.perform expect value', async ({ page, server }) => {
  await page.setContent(`
    <script>
    function onInput(event) {
      if (!event.target.value.match(/^[^@]+@[^@]+$/))
        document.getElementById('error').style.display = 'block';
      else
        document.getElementById('error').style.display = 'none';
    }
    </script>
    <input type="email" name="email" placeholder="Email Address" oninput="onInput(event);"/>
    <div id="error" style="color: red; display: none;">Error: Invalid email address</div>
  `);
  await page.agent.perform(`
    - Enter "bogus" into the email field
    - Check that the value is in fact "bogus"
    - Check that the error message is displayed
  `);
});
