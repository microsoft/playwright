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
import { setCacheObject, runAgent } from './agent-helpers';

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
  const error = await agent.expect('submit button is visible', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeVisible() failed

Locator: getByRole('button')
Expected: visible
Timeout: 1000ms
Error: element(s) not found

Call log:
  - Expect Visible
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
  const error = await agent.expect('submit button is visible', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeVisible() failed

Locator:  locator('button')
Expected: visible
Received: hidden
Timeout:  1000ms

Call log:
  - Expect Visible
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
  const error = await agent.expect('submit button is not visible', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).not.toBeVisible() failed

Locator:  locator('button')
Expected: not visible
Received: visible
Timeout:  1000ms

Call log:
  - Expect Visible
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
  const error = await agent.expect('checkbox is checked', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toBeChecked() failed

Locator:  locator('input')
Expected: checked
Received: unchecked
Timeout:  1000ms

Call log:
  - Expect Checked
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
  const error = await agent.expect('input has value "hello"', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`pageAgent.expect: expect(locator).toHaveValue(expected) failed

Locator:  locator('input')
Expected: hello
Received: world
Timeout:  1000ms

Call log:
  - Expect Value
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
  const error = await agent.expect('two items are visible', { timeout: 1000 }).catch(e => e);
  const errorMessage = `pageAgent.expect: expect(locator).toMatchAriaSnapshot(expected) failed

Locator:  locator('body')
Expected:
- list:
  - listitem: one
  - listitem: two
Received:
- list:
  - listitem: one
Timeout:  1000ms

Call log:
  - Expect Aria Snapshot
  - waiting for locator('body')`.replace('Expected:', 'Expected: ').replace('Received:', 'Received: ');
  expect(stripAnsi(error.message)).toContain(errorMessage);
});
