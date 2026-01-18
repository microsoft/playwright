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

import { browserTest as test, expect } from '../config/browserTest';
import { generateAgent } from './agent-helpers';

test('should respect total max tokens limit', async ({ context }) => {
  const { page, agent } = await generateAgent(context, {
    limits: {
      maxTokens: 123,
    },
  });
  await page.setContent(`
    <button>Submit</button>
  `);
  const e = await agent.perform('Click submit button').catch(e => e);
  expect(e.message.toLowerCase()).toContain('budget');
  expect(e.message).toContain('123');
});

test('should respect call max tokens limit', async ({ context }) => {
  const { page, agent } = await generateAgent(context);
  await page.setContent(`
    <button>Submit</button>
  `);
  const e = await agent.perform('Click submit button', { maxTokens: 123 }).catch(e => e);
  expect(e.message.toLowerCase()).toContain('budget');
  expect(e.message).toContain('123');
});

test('should respect max actions limit', async ({ context }) => {
  const { page, agent } = await generateAgent(context);
  let clicked = 0;
  await page.exposeFunction('clicked', () => ++clicked);
  await page.setContent(`
    <button onclick="clicked()">Submit</button>
  `);
  const e = await agent.perform('Click the submit button 5 times', { maxActions: 3 }).catch(e => e);
  expect(e.message).toContain('Failed to perform step, max tool calls (3) reached');
  expect(clicked).toBe(3);
});
