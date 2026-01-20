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

import { stripAnsi } from '../config/utils';
import { browserTest as test, expect } from '../config/browserTest';
import { setCacheObject, runAgent, generateAgent, cacheObject } from './agent-helpers';

// LOWIRE_NO_CACHE=1 to generate api caches
// LOWIRE_FORCE_CACHE=1 to force api caches

test('expectVisible not found error', async ({ context }) => {
  await setCacheObject({
    'submit button is visible': {
      actions: [{
        code: '',
        method: 'expectVisible',
        selector: `internal:role=button`,
      }],
    },
  });
  const { page, agent } = await runAgent(context);
  await page.setContent(`<button hidden>Submit</button>`);
  const error = await agent.expect('submit button is visible').catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeVisible() failed

Locator: getByRole('button')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect Visible with timeout 5000ms
  - waiting for getByRole('button')`);
});

test('expectVisible not visible error', async ({ context }) => {
  await setCacheObject({
    'submit button is visible': {
      actions: [{
        code: '',
        method: 'expectVisible',
        selector: `button`,
      }],
    },
  });
  const { page, agent } = await runAgent(context);
  await page.setContent(`<button hidden>Submit</button>`);
  const error = await agent.expect('submit button is visible').catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeVisible() failed

Locator:  locator('button')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect Visible with timeout 5000ms
  - waiting for locator('button')`);
});

test('not expectVisible visible error', async ({ context }) => {
  await setCacheObject({
    'submit button is not visible': {
      actions: [{
        code: '',
        method: 'expectVisible',
        selector: `button`,
        isNot: true,
      }],
    },
  });
  const { page, agent } = await runAgent(context);
  await page.setContent(`<button>Submit</button>`);
  const error = await agent.expect('submit button is not visible').catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).not.toBeVisible() failed

Locator:  locator('button')
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
  - Expect Visible with timeout 5000ms
  - waiting for locator('button')`);
});

test('expectChecked not checked error', async ({ context }) => {
  await setCacheObject({
    'checkbox is checked': {
      actions: [{
        code: '',
        method: 'expectValue',
        type: 'checkbox',
        value: 'true',
        selector: `input`,
      }],
    },
  });
  const { page, agent } = await runAgent(context);
  await page.setContent(`<input type=checkbox>`);
  const error = await agent.expect('checkbox is checked').catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeChecked() failed

Locator:  locator('input')
Expected: checked
Received: unchecked
Timeout:  5000ms

Call log:
  - Expect Checked with timeout 5000ms
  - waiting for locator('input')`);
});

test('expectValue wrong value error', async ({ context }) => {
  await setCacheObject({
    'input has value "hello"': {
      actions: [{
        code: '',
        method: 'expectValue',
        type: 'textbox',
        value: 'hello',
        selector: `input`,
      }],
    },
  });
  const { page, agent } = await runAgent(context);
  await page.setContent(`<input type=text value="world">`);
  const error = await agent.expect('input has value "hello"').catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toHaveValue(expected) failed

Locator:  locator('input')
Expected: hello
Received: world
Timeout:  5000ms

Call log:
  - Expect Value with timeout 5000ms
  - waiting for locator('input')`);
});

test('expectAria wrong snapshot error', async ({ context }) => {
  await setCacheObject({
    'two items are visible': {
      actions: [{
        code: '',
        method: 'expectAria',
        template: '- list:\n  - listitem: one\n  - listitem: two',
      }],
    },
  });
  const { page, agent } = await runAgent(context);
  await page.setContent(`<ul><li>one</li><li style="display:none">two</li></ul>`);
  const error = await agent.expect('two items are visible').catch(e => e);
  const errorMessage = `pageAgent.expect: expect(locator).toMatchAriaSnapshot(expected) failed

Locator:  locator('body')
Expected:
- list:
  - listitem: one
  - listitem: two
Received:
- list:
  - listitem: one
Timeout:  5000ms

Call log:
  - Expect Aria Snapshot with timeout 5000ms
  - waiting for locator('body')`.replace('Expected:', 'Expected: ').replace('Received:', 'Received: ');
  expect(stripAnsi(error.message)).toContain(errorMessage);
});

test('expect timeout during run', async ({ context }) => {
  {
    const { page, agent } = await generateAgent(context);
    await page.setContent(`<button>Submit</button>`);
    await agent.expect('submit button is visible');
  }
  expect(await cacheObject()).toEqual({
    'submit button is visible': {
      actions: [expect.objectContaining({ method: 'expectVisible' })],
    },
  });
  {
    const { page, agent } = await runAgent(context);
    await page.setContent(`<button hidden>Submit</button>`);
    const error = await agent.expect('submit button is visible', { timeout: 3000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Submit' })
Expected: visible
Timeout: 3000ms
Error: element(s) not found

Call log:
  - Expect Visible with timeout 3000ms`);
  }
});

test('expect timeout during run from agent options', async ({ context }) => {
  {
    const { page, agent } = await generateAgent(context);
    await page.setContent(`<button>Submit</button>`);
    await agent.expect('submit button is visible');
  }
  expect(await cacheObject()).toEqual({
    'submit button is visible': {
      actions: [expect.objectContaining({ method: 'expectVisible' })],
    },
  });
  {
    const { page, agent } = await runAgent(context, { expect: { timeout: 3000 } });
    await page.setContent(`<button hidden>Submit</button>`);
    const error = await agent.expect('submit button is visible').catch(e => e);
    expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeVisible() failed`);
    expect(stripAnsi(error.message)).toContain(`Expect Visible with timeout 3000ms`);
  }
});

test('expect timeout during generate', async ({ context }) => {
  const { page, agent } = await generateAgent(context, { limits: { maxActionRetries: 0 } });
  await page.setContent(`<input type=text value="bye">`);
  const error = await agent.expect('input has value "hello"').catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: Agentic loop failed: Failed to perform action after 0 tool call retries
Call log:
  - Expect Value
  - waiting for getByRole('textbox')`);
  expect(stripAnsi(error.message)).toContain(`- unexpected value "bye"`);
});

test('expectURL success', async ({ context, server }) => {
  const secrets = {
    SERVER: server.PREFIX
  };
  {
    const { page, agent } = await generateAgent(context, { secrets });
    await page.goto(server.PREFIX + '/counter.html');
    await agent.expect('page URL is /counter.html');
  }
  expect(await cacheObject()).toEqual({
    'page URL is /counter.html': {
      actions: [expect.objectContaining({ method: 'expectURL' })],
    },
  });
  {
    const { page, agent } = await runAgent(context, { secrets });
    await page.goto(server.PREFIX + '/counter.html');
    await agent.expect('page URL is /counter.html');
  }
});

test('expectURL wrong URL error', async ({ context, server }) => {
  const secrets = {
    SERVER: server.PREFIX
  };
  {
    const { page, agent } = await generateAgent(context, { secrets });
    await page.goto(server.PREFIX + '/counter.html');
    await agent.expect('page URL is /counter.html');
  }
  expect(await cacheObject()).toEqual({
    'page URL is /counter.html': {
      actions: [expect.objectContaining({ method: 'expectURL' })],
    },
  });
  {
    const { page, agent } = await runAgent(context, { secrets });
    await page.goto(server.PREFIX + '/empty.html');
    const error = await agent.expect('page URL is /counter.html').catch(e => e);
    expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(page).toHaveURL(expected) failed`);
    expect(stripAnsi(error.message)).toContain(`Received: ${server.PREFIX}/empty.html`);
  }
});

test('expectURL with regex', async ({ context, server }) => {
  const secrets = {
    SERVER: server.PREFIX
  };
  {
    const { page, agent } = await generateAgent(context, { secrets });
    await page.goto(server.PREFIX + '/counter.html');
    await agent.expect('page URL matches /counter pattern');
  }
  expect(await cacheObject()).toEqual({
    'page URL matches /counter pattern': {
      actions: [expect.objectContaining({ method: 'expectURL', regex: expect.any(String) })],
    },
  });
  {
    const { page, agent } = await runAgent(context, { secrets });
    await page.goto(server.PREFIX + '/counter.html');
    await agent.expect('page URL matches /counter pattern');
  }
});

test('expectURL with regex error', async ({ context, server }) => {
  const secrets = {
    SERVER: server.PREFIX
  };
  {
    const { page, agent } = await generateAgent(context, { secrets });
    await page.goto(server.PREFIX + '/counter.html');
    await agent.expect('page URL matches /counter pattern');
  }
  expect(await cacheObject()).toEqual({
    'page URL matches /counter pattern': {
      actions: [expect.objectContaining({ method: 'expectURL', regex: expect.any(String) })],
    },
  });
  {
    const { page, agent } = await runAgent(context, { secrets });
    await page.goto(server.PREFIX + '/empty.html');
    const error = await agent.expect('page URL matches /counter pattern').catch(e => e);
    expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(page).toHaveURL(expected) failed`);
    expect(stripAnsi(error.message)).toContain(`Received: ${server.PREFIX}/empty.html`);
  }
});

test('expectTitle success', async ({ context }) => {
  {
    const { page, agent } = await generateAgent(context);
    await page.setContent(`<title>My Page Title</title>`);
    await agent.expect('page title is "My Page Title"');
  }
  expect(await cacheObject()).toEqual({
    'page title is "My Page Title"': {
      actions: [expect.objectContaining({ method: 'expectTitle' })],
    },
  });
  {
    const { page, agent } = await runAgent(context);
    await page.setContent(`<title>My Page Title</title>`);
    await agent.expect('page title is "My Page Title"');
  }
});

test('expectTitle wrong title error', async ({ context }) => {
  {
    const { page, agent } = await generateAgent(context);
    await page.setContent(`<title>Other Title</title>`);
    await agent.expect('page title is "Other Title"');
  }
  expect(await cacheObject()).toEqual({
    'page title is "Other Title"': {
      actions: [expect.objectContaining({ method: 'expectTitle' })],
    },
  });
  {
    const { page, agent } = await runAgent(context);
    await page.setContent(`<title>My Page Title</title>`);
    const error = await agent.expect('page title is "Other Title"').catch(e => e);
    expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(page).toHaveTitle(expected) failed`);
    expect(stripAnsi(error.message)).toContain(`Received: My Page Title`);
  }
});
