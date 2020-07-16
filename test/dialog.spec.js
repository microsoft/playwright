/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const {FIREFOX, CHROMIUM, WEBKIT} = require('playwright-runner');
const {it} = require('./environments/server');
const {WIN, USES_HOOKS, CHANNEL} = require('./utils');

describe('Page.Events.Dialog', function() {
  it('should fire', async ({page, server}) => {
    page.on('dialog', dialog => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.defaultValue()).toBe('');
      expect(dialog.message()).toBe('yo');
      dialog.accept();
    });
    await page.evaluate(() => alert('yo'));
  });
  it('should allow accepting prompts', async ({page, server}) => {
    page.on('dialog', dialog => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.defaultValue()).toBe('yes.');
      expect(dialog.message()).toBe('question?');
      dialog.accept('answer!');
    });
    const result = await page.evaluate(() => prompt('question?', 'yes.'));
    expect(result).toBe('answer!');
  });
  it('should dismiss the prompt', async ({page, server}) => {
    page.on('dialog', dialog => {
      dialog.dismiss();
    });
    const result = await page.evaluate(() => prompt('question?'));
    expect(result).toBe(null);
  });
  it('should accept the confirm prompt', async ({page, server}) => {
    page.on('dialog', dialog => {
      dialog.accept();
    });
    const result = await page.evaluate(() => confirm('boolean?'));
    expect(result).toBe(true);
  });
  it('should dismiss the confirm prompt', async ({page, server}) => {
    page.on('dialog', dialog => {
      dialog.dismiss();
    });
    const result = await page.evaluate(() => confirm('boolean?'));
    expect(result).toBe(false);
  });
  it.todo(CHANNEL)('should log prompt actions', async ({browser}) => {
    const messages = [];
    const context = await browser.newContext({
      logger: {
        isEnabled: () => true,
        log: (name, severity, message) => messages.push(message),
      }
    });
    const page = await context.newPage();
    const promise = page.evaluate(() => confirm('01234567890123456789012345678901234567890123456789012345678901234567890123456789'));
    const dialog = await page.waitForEvent('dialog');
    expect(messages.join()).toContain('confirm "0123456789012345678901234567890123456789012345678…" was shown');
    await dialog.accept('123');
    await promise;
    expect(messages.join()).toContain('confirm "0123456789012345678901234567890123456789012345678…" was accepted');
    await context.close();
  });
  it.todo(WEBKIT)('should be able to close context with open alert', async ({browser}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const alertPromise = page.waitForEvent('dialog');
    await page.evaluate(() => {
      setTimeout(() => alert('hello'), 0);
    });
    await alertPromise;
    await context.close();
  });
});
