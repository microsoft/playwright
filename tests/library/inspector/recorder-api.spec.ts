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
  actions: (actions.ActionInContext & { code: string[] })[] = [];

  actionAdded(page: Page, actionInContext: actions.ActionInContext, code: string[]): void {
    this.actions.push({ ...actionInContext, code });
  }

  actionUpdated(page: Page, actionInContext: actions.ActionInContext, code: string[]): void {
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
    lastAction: () => log.actions[log.actions.length - 1],
  };
}

test('should click', async ({ context }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log('click')">Submit</button>`);

  await page.getByRole('button', { name: 'Submit' }).click();

  expect(log.lastAction()).toEqual(
      expect.objectContaining({
        action: expect.objectContaining({
          name: 'click',
          selector: 'internal:role=button[name="Submit"i]',
          ref: 'e2',
          ariaSnapshot: '- button "Submit" [active] [ref=e2] [cursor=pointer]',
        }),
        code: [`  await page.getByRole('button', { name: 'Submit' }).click();`],
        startTime: expect.any(Number),
      }));
});

test('should type', async ({ context }) => {
  const log = await startRecording(context);
  const page = await context.newPage();
  await page.setContent(`<input type="text" />`);

  await page.getByRole('textbox').pressSequentially('Hello');

  expect(log.lastAction()).toEqual(
      expect.objectContaining({
        action: expect.objectContaining({
          name: 'fill',
          selector: 'internal:role=textbox',
          ref: 'e2',
          ariaSnapshot: '- textbox [active] [ref=e2] [cursor=pointer]: Hello',
        }),
        code: [`  await page.getByRole('textbox').fill('Hello');`],
        startTime: expect.any(Number),
      }));
});
