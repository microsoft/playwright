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
  agentOptions: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
    secrets: {
      'x-secret-email': 'secret-email@at-microsoft.com',
    }
  }
});

test('page.perform', async ({ page, agent, server }) => {
  await page.goto(server.PREFIX + '/evals/fill-form.html');
  agent.on('turn', turn => {
    // For debugging purposes it is on for now.
    console.log('agentturn', turn);
  });
  await agent.perform('Fill out the form with the following details:\n' +
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

test('page.perform secret', async ({ page, agent }) => {
  await page.setContent('<input type="email" name="email" placeholder="Email Address"/>');
  await agent.perform('Enter x-secret-email into the email field');
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - textbox "Email Address": secret-email@at-microsoft.com
  `);
});

test.skip('extract task', async ({ page, agent }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  await agent.perform('Add "Buy groceries" todo');
  console.log(await agent.extract('List todos with their statuses', z.object({
    items: z.object({
      title: z.string(),
      completed: z.boolean()
    }).array()
  })));
});

test('page.perform expect value', async ({ page, agent }) => {
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
  await agent.perform(`
    - Enter "bogus" into the email field
    - Check that the value is in fact "bogus"
    - Check that the error message is displayed
  `);
});

test('page.perform history', async ({ page, agent }) => {
  test.skip(true, 'Skipping because it needs LLM');
  await page.setContent(`
    <button>Wolf</button>
    <button>Fox</button>
    <button>Rabbit</button>
  `);
  await agent.perform('click the Fox button');
  const { result } = await agent.extract('return the name of the button you pressed', z.object({
    name: z.string(),
  }));
  expect(result.name).toBe('Fox');
});
