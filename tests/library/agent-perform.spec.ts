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

import { z as zod3 } from 'zod/v3';
import * as zod4 from 'zod';

import { browserTest as test, expect } from '../config/browserTest';
import { run, generateAgent, cacheObject, runAgent, setCacheObject } from './agent-helpers';

// LOWIRE_NO_CACHE=1 to generate api caches
// LOWIRE_FORCE_CACHE=1 to force api caches

test('click a button', async ({ context }) => {
  await run(context, async (page, agent) => {
    let clicked = 0;
    await page.exposeFunction('clicked', () => ++clicked);
    await page.setContent(`<button onclick="clicked()">Submit</button>`);
    await agent.perform('click the Submit button');
    expect(clicked).toBe(1);
  });

  expect(await cacheObject()).toEqual({
    'click the Submit button': {
      actions: [{
        code: `await page.getByRole('button', { name: 'Submit' }).click();`,
        method: 'click',
        selector: `internal:role=button[name=\"Submit\"i]`,
      }],
    },
  });
});

// broken, let's fix later
test.fail('retrieve a secret', async ({ context }) => {
  await run(context, async (page, agent) => {
    await page.setContent('<input type="email" name="email" placeholder="Email Address"/>');
    await agent.perform('Enter x-secret-email into the email field');
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - textbox "Email Address": secret-email@at-microsoft.com
    `);
  }, { secrets: { 'x-secret-email': 'secret-email@at-microsoft.com' } });

  expect(await cacheObject()).toEqual({
    'Enter x-secret-email into the email field': {
      actions: [{
        code: `await page.getByRole('textbox', { name: 'Email Address' }).fill('secret-email@at-microsoft.com');`,
        method: 'fill',
        selector: `internal:role=textbox[name=\"Email Address\"i]`,
        text: 'secret-email@at-microsoft.com',
      }],
    },
  });
});

test('extract task', async ({ context }) => {
  const { page, agent } = await generateAgent(context);
  await page.setContent(`
    <ul>
      <li>Buy groceries [DONE]</li>
      <li>Buy milk [PENDING]</li>
    </ul>
  `);

  await test.step('zod 3', async () => {
    const { result } = await agent.extract('List todos with their statuses', zod3.object({
      items: zod3.object({
        title: zod3.string(),
        completed: zod3.boolean(),
      }).array(),
    }));

    expect(result.items).toEqual([
      { title: 'Buy groceries', completed: true },
      { title: 'Buy milk', completed: false }
    ]);
  });

  await test.step('zod 4', async () => {
    const { result } = await agent.extract('List todos with their statuses', zod4.object({
      items: zod4.object({
        title: zod4.string(),
        completed: zod4.boolean(),
      }).array(),
    }));

    expect(result.items).toEqual([
      { title: 'Buy groceries', completed: true },
      { title: 'Buy milk', completed: false }
    ]);
  });
});

test('expect value', async ({ context }) => {
  const task = `
  - Enter "bogus" into the email field
  - Check that the value is in fact "bogus"
  - Check that the error message is displayed
`;

  await run(context, async (page, agent) => {
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
    await agent.perform(task);
  });

  const expectations = {};
  expectations[task.trim()] = {
    actions: [{
      code: `await page.getByRole('textbox', { name: 'Email Address' }).fill('bogus');`,
      method: 'fill',
      selector: `internal:role=textbox[name=\"Email Address\"i]`,
      text: 'bogus',
    }],
  };
  expect(await cacheObject()).toEqual(expectations);
});

test('perform history', async ({ context }) => {
  await run(context, async (page, agent) => {
    let clicked = 0;
    await page.exposeFunction('clicked', () => clicked++);
    await page.setContent(`
      <button>Wolf</button>
      <button onclick="clicked()">Fox</button>
      <button>Rabbit</button>
    `);
    await agent.perform('click the Fox button');
    await agent.perform('click the Fox button again');
    expect(clicked).toBe(2);
  });
});

test('perform run timeout', async ({ context }) => {
  {
    const { page, agent } = await generateAgent(context);
    await page.setContent(`
      <button>Wolf</button>
      <button>Fox</button>
    `);
    await agent.perform('click the Fox button');
  }
  {
    const { page, agent } = await runAgent(context);
    await page.setContent(`
      <button>Wolf</button>
      <button>Rabbit</button>
    `);
    const error = await agent.perform('click the Fox button', { timeout: 3000 }).catch(e => e);
    expect(error.message).toContain('Timeout 3000ms exceeded.');
    expect(error.message).toContain(`waiting for getByRole('button', { name: 'Fox' })`);
  }
});

test('invalid cache file throws error', async ({ context }) => {
  await setCacheObject({
    'some key': {
      actions: [{
        method: 'invalid-method',
      }],
    },
  });
  const { agent } = await runAgent(context);
  await expect(() => agent.perform('click the Test button')).rejects.toThrowError(`
Failed to parse cache file ${test.info().outputPath('agent-cache.json')}:
✖ Invalid input
  → at [\"some key\"].actions[0].method
✖ Invalid input: expected string, received undefined
  → at [\"some key\"].actions[0].code
    `.trim());
});
