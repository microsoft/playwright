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
import type * as actions from '@recorder/actions';

class RecorderLog {
  actions: (actions.ActionInContext & { code: string })[] = [];

  actionAdded(page: Page, actionInContext: actions.ActionInContext, code: string): void {
    this.actions.push({ ...actionInContext, code });
  }

  actionUpdated(page: Page, actionInContext: actions.ActionInContext, code: string): void {
    this.actions[this.actions.length - 1] = { ...actionInContext, code };
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
  };
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, ' ').trim();
}

test('should click', async ({ context, browserName, platform }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log('click')">Submit</button>`);
  await page.getByRole('button', { name: 'Submit' }).click();

  const clickActions = log.action('click');
  expect(clickActions).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'click',
        selector: 'internal:role=button[name="Submit"i]',
        ref: 'e2',
        // Safari does not focus after a click: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#clicking_and_focus
        ariaSnapshot: (browserName === 'webkit' && (platform === 'darwin' || platform === 'win32')) ? '- button "Submit" [ref=e2]' : '- button "Submit" [active] [ref=e2]',
      }),
      startTime: expect.any(Number),
    })
  ]);

  expect(normalizeCode(clickActions[0].code)).toEqual(`await page.getByRole('button', { name: 'Submit' }).click();`);
});

test('should double click', async ({ context, browserName, platform }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log('click')" ondblclick="console.log('dblclick')">Submit</button>`);
  await page.getByRole('button', { name: 'Submit' }).dblclick();

  const clickActions = log.action('click');
  expect(clickActions).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'click',
        clickCount: 2,
        selector: 'internal:role=button[name="Submit"i]',
        ref: 'e2',
        // Safari does not focus after a click: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#clicking_and_focus
        ariaSnapshot: (browserName === 'webkit' && (platform === 'darwin' || platform === 'win32')) ? '- button "Submit" [ref=e2]' : '- button "Submit" [active] [ref=e2]',
      }),
      startTime: expect.any(Number),
    })
  ]);

  expect(normalizeCode(clickActions[0].code)).toEqual(`await page.getByRole('button', { name: 'Submit' }).dblclick();`);
});

test('should right click', async ({ context, browserName, platform }) => {
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
        ariaSnapshot: (browserName === 'webkit' && (platform === 'darwin' || platform === 'win32')) ? '- button "Submit" [ref=e2]' : '- button "Submit" [active] [ref=e2]',
      }),
      startTime: expect.any(Number),
    })
  ]);

  expect(normalizeCode(clickActions[0].code)).toEqual(`await page.getByRole('button', { name: 'Submit' }).click({ button: 'right' });`);
});

test('should type', async ({ context }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<input type="text" />`);

  await page.getByRole('textbox').pressSequentially('Hello');

  const fillActions = log.action('fill');
  expect(fillActions).toEqual([
    expect.objectContaining({
      action: expect.objectContaining({
        name: 'fill',
        selector: 'internal:role=textbox',
        ref: 'e2',
        ariaSnapshot: '- textbox [active] [ref=e2]: Hello',
      }),
      startTime: expect.any(Number),
    })
  ]);

  expect(normalizeCode(fillActions[0].code)).toEqual(`await page.getByRole('textbox').fill('Hello');`);
});
