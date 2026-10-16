/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test as it, expect } from './pageTest';

it('SM-001 should fail page.textContent in strict mode', async ({ page }) => {
  await page.setContent(`<span>span1</span><div><span>target</span></div>`);
  const error = await page.textContent('span', { strict: true }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`1) <span>span1</span> aka getByText('span1')`);
  expect(error.message).toContain(`2) <span>target</span> aka getByText('target')`);
});

it('SM-002 should fail page.getAttribute in strict mode', async ({ page }) => {
  await page.setContent(`<span>span1</span><div><span>target</span></div>`);
  const error = await page.getAttribute('span', 'id', { strict: true }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
});

it('SM-003 should fail page.fill in strict mode', async ({ page }) => {
  await page.setContent(`<input></input><div><input></input></div>`);
  const error = await page.fill('input', 'text', { strict: true }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`1) <input/> aka getByRole('textbox').first()`);
  expect(error.message).toContain(`2) <input/> aka locator('div').getByRole('textbox')`);
});

it('SM-004 should fail page.$ in strict mode', async ({ page }) => {
  await page.setContent(`<span>span1</span><div><span>target</span></div>`);
  const error = await page.$('span', { strict: true }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
});

it('SM-005 should fail page.waitForSelector in strict mode', async ({ page }) => {
  await page.setContent(`<span>span1</span><div><span>target</span></div>`);
  const error = await page.waitForSelector('span', { strict: true }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
});

it('SM-006 should fail page.dispatchEvent in strict mode', async ({ page }) => {
  await page.setContent(`<span></span><div><span></span></div>`);
  const error = await page.dispatchEvent('span', 'click', {}, { strict: true }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`1) <span></span> aka locator('span').first()`);
  expect(error.message).toContain(`2) <span></span> aka locator('div span')`);
});

it('SM-007 should properly format :nth-child() in strict mode message', async ({ page }) => {
  await page.setContent(`
  <div>
    <div>
    </div>
    <div>
      <div>
      </div>
      <div>
      </div>
    </div>
  </div>
  <div>
    <div class='foo'>
    </div>
    <div class='foo'>
    </div>
  </div>
  `);
  const error = await page.locator('.foo').hover().catch(e => e);
  expect(error.message).toContain('strict mode violation');
  // Second div has body > div:nth-child(2) > div:nth-child(2) selector which would be ambiguous
  // if '>' were ' '.
  expect(error.message).toContain('body > div:nth-child(2) > div:nth-child(2)');
});

it('SM-008 should escape class names', async ({ page }) => {
  await page.setContent(`
  <div>
    <div></div>
    <div>
      <div></div>
      <div></div>
    </div>
  </div>
  <div>
    <div class='foo bar:0'>
    </div>
    <div class='foo bar:1'>
    </div>
  </div>
  `);
  const error = await page.locator('.foo').hover().catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain('<div class=\"foo bar:0');
  expect(error.message).toContain('<div class=\"foo bar:1');
});

it('SM-009 should escape tag names', async ({ page }) => {
  await page.setContent(`
    <q:template> </q:template>
    <span>special test description</span>
    <q:template hidden="" aria-hidden="true">
      <span>special test description</span>
    </q:template>
  `);
  const error = await expect(page.getByText('special test description')).toBeVisible().catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`getByText('special test description').first()`);
  expect(error.message).toContain(`locator('q\\\\:template').filter({ hasText: 'special test description' })`);
});

it('SM-010 should keep the engine name for a "text=.." selector in strict mode', async ({ page }) => {
  await page.setContent(`<div>..loading</div><div>..loading</div>`);
  const error = await page.locator('text=..loading').hover().catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`locator('text=..loading')`);
});
