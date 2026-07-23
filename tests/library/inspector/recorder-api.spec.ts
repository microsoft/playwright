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

import { test, expect } from './inspectorTest';

import type { Page } from '@playwright/test';
import type * as actions from '@isomorphic/codegen/actions';

class RecorderLog {
  actions: { action: actions.Action, code: string }[] = [];
  signals: { signal: actions.Signal, code: string }[] = [];

  actionAdded(page: Page, action: actions.Action, code: string): void {
    this.actions.push({ action, code });
  }

  signalAdded(page: Page, signal: actions.Signal, code: string): void {
    this.signals.push({ signal, code });
  }
}

async function startRecording(context) {
  const log = new RecorderLog();
  await (context as any)._enableRecorder({
    mode: 'recording',
    recorderMode: 'api',
  }, log);
  return {
    action: (name: string) => log.actions.filter(a => a.action.name === name),
    signals: () => log.signals,
  };
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, ' ').trim();
}

test('should click', async ({ context, browserName, platform, channel }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log('click')">Submit</button>`);
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect.poll(() => log.action('click')).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'click',
        selector: 'internal:role=button[name="Submit"i]',
        ref: 'e2',
        // Safari does not focus after a click: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#clicking_and_focus
        ariaSnapshot: (browserName === 'webkit' && (platform === 'darwin' || (platform === 'win32' && channel !== 'webkit-wsl'))) ? '- button "Submit" [ref=e2]' : '- button "Submit" [active] [ref=e2]',
      }),
    })
  ]);

  expect(normalizeCode(log.action('click')[0].code)).toEqual(`await page.getByRole('button', { name: 'Submit' }).click();`);
});

test('should double click', async ({ context, browserName, platform, channel }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log('click')" ondblclick="console.log('dblclick')">Submit</button>`);
  await page.getByRole('button', { name: 'Submit' }).dblclick();

  await expect.poll(() => log.action('click')).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'click',
        clickCount: 2,
        selector: 'internal:role=button[name="Submit"i]',
        ref: 'e2',
        // Safari does not focus after a click: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#clicking_and_focus
        ariaSnapshot: (browserName === 'webkit' && (platform === 'darwin' || (platform === 'win32' && channel !== 'webkit-wsl'))) ? '- button "Submit" [ref=e2]' : '- button "Submit" [active] [ref=e2]',
      }),
    })
  ]);

  expect(normalizeCode(log.action('click')[0].code)).toEqual(`await page.getByRole('button', { name: 'Submit' }).dblclick();`);
});

test('should right click', async ({ context, browserName, platform, channel }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button oncontextmenu="console.log('contextmenu')">Submit</button>`);
  await page.getByRole('button', { name: 'Submit' }).click({ button: 'right' });

  const clickActions = log.action('click');
  expect(clickActions).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'click',
        button: 'right',
        selector: 'internal:role=button[name="Submit"i]',
        ref: 'e2',
        // Safari does not focus after a click: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#clicking_and_focus
        ariaSnapshot: (browserName === 'webkit' && (platform === 'darwin' || (platform === 'win32' && channel !== 'webkit-wsl'))) ? '- button "Submit" [ref=e2]' : '- button "Submit" [active] [ref=e2]',
      }),
    })
  ]);

  expect(normalizeCode(clickActions[0].code)).toEqual(`await page.getByRole('button', { name: 'Submit' }).click({ button: 'right' });`);
});

test('should send updated code with the signal', async ({ context, server }) => {
  const recorder = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<a target=_blank rel=noopener href="${server.EMPTY_PAGE}">link</a>`);
  await page.getByRole('link', { name: 'link' }).click();

  // The popup signal attaches to the click, so the click's code is re-generated to await it.
  await expect.poll(() => recorder.signals().map(s => s.signal.name)).toContain('popup');
  const code = recorder.signals().find(s => s.signal.name === 'popup')!.code;
  expect(normalizeCode(code)).toContain(`const page1Promise = page.waitForEvent('popup');`);
  expect(normalizeCode(code)).toContain(`await page.getByRole('link', { name: 'link' }).click();`);
  expect(normalizeCode(code)).toContain(`const page1 = await page1Promise;`);
});

test('should type', async ({ context }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<input type="text" />`);

  await page.getByRole('textbox').pressSequentially('Hello');

  await expect.poll(() => log.action('fill')).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'fill',
        selector: 'internal:role=textbox',
        ref: 'e2',
        ariaSnapshot: '- textbox [active] [ref=e2]: Hello',
      }),
    })
  ]);

  expect(normalizeCode(log.action('fill')[0].code)).toEqual(`await page.getByRole('textbox').fill('Hello');`);
});

test('should disable recorder', async ({ context }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log('click')">Submit</button>`);
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect.poll(() => log.action('click').length).toBe(2);
  await (context as any)._disableRecorder();
  await page.getByRole('button', { name: 'Submit' }).click();
  // Give it some time to produce more actions - there should be none.
  await page.waitForTimeout(2000);
  expect(log.action('click')).toHaveLength(2);
});

test('page.pickLocator should return locator for picked element', async ({ page }) => {
  await page.setContent(`<button>Submit</button>`);

  const scriptReady = page.waitForEvent('console', msg => msg.text() === 'Recorder script ready for test');
  const pickPromise = page.pickLocator();
  await scriptReady;

  const box = await page.getByRole('button', { name: 'Submit' }).boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const locator = await pickPromise;
  await expect(locator).toHaveText('Submit');
});

test('page.cancelPickLocator should cancel ongoing pickLocator', async ({ page }) => {
  const pickPromise = page.pickLocator();
  await Promise.all([
    page.cancelPickLocator(),
    expect(pickPromise).rejects.toThrow('Locator picking was cancelled')
  ]);
});

test('closing page should cancel ongoing pickLocator', async ({ page }) => {
  await page.setContent(`<button>Click me</button>`);
  const pickPromise = page.pickLocator().catch(e => e.message);
  await page.close();
  expect(await pickPromise).toContain('Target page, context or browser has been closed');
});

test('page2.pickLocator() should cancel page1.pickLocator()', async ({ page, context, browserName, headless, isMac, macVersion }) => {
  test.skip(browserName === 'chromium' && !headless && isMac && macVersion === 14, 'times out on chromium headed on macOS 14');
  const pick1Promise = page.pickLocator().catch(e => e.message);

  const page2 = await context.newPage();
  page2.pickLocator().catch(() => {});

  expect(await pick1Promise).toContain('Locator picking was cancelled');
});
