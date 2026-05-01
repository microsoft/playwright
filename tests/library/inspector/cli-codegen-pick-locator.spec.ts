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
import { roundBox } from '../../config/utils';

test.describe(() => {
  test('should inspect locator', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<main><button>Submit</button></main>`);
    await recorder.page.click('x-pw-tool-item.pick-locator');
    await recorder.page.hover('button');
    await recorder.trustedClick();
    await recorder.recorderPage.getByRole('tab', { name: 'Locator' }).click();
    await expect(recorder.recorderPage.locator('.tab-locator .CodeMirror')).toMatchAriaSnapshot(`
      - text: "getByRole('button', { name: 'Submit' })"
    `);
  });

  test('should shift-click to interact with page while picking locator', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`
      <button onclick="document.getElementById('target').textContent = 'clicked'">Click me</button>
      <div id="target">initial</div>
    `);

    // Enter pick locator mode.
    await recorder.page.click('x-pw-tool-item.pick-locator');

    // Shift+click the button - should interact with the page, not pick a locator.
    const button = recorder.page.getByRole('button', { name: 'Click me' });
    await recorder.trustedMove(button);
    await recorder.page.keyboard.down('Shift');
    await recorder.trustedClick();
    await recorder.page.keyboard.up('Shift');

    // Verify the page interaction happened.
    await expect(recorder.page.locator('#target')).toHaveText('clicked');

    // Now click without Shift - should pick the locator.
    const target = recorder.page.locator('#target');
    await recorder.trustedMove(target);
    await recorder.trustedClick();
    await recorder.recorderPage.getByRole('tab', { name: 'Locator' }).click();
    await expect(recorder.recorderPage.locator('.tab-locator .CodeMirror')).toMatchAriaSnapshot(`
      - text: "getByText('clicked')"
    `);
  });

  test('should update locator highlight', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<main>
      <button>Submit</button>
      <button>Cancel</button>
    </main>`);

    const submitButton = recorder.page.getByRole('button', { name: 'Submit' });
    const cancelButton = recorder.page.getByRole('button', { name: 'Cancel' });

    await recorder.recorderPage.getByRole('button', { name: 'Record' }).click();

    await recorder.page.click('x-pw-tool-item.pick-locator');
    await submitButton.hover();
    await recorder.trustedClick();
    await recorder.recorderPage.getByRole('tab', { name: 'Locator' }).click();
    await expect(recorder.recorderPage.locator('.tab-locator .CodeMirror')).toMatchAriaSnapshot(`
      - text: "getByRole('button', { name: 'Submit' })"
    `);

    await recorder.recorderPage.locator('.tab-locator .CodeMirror').click();
    for (let i = 0; i < `Submit' })`.length; i++)
      await recorder.recorderPage.keyboard.press('Backspace');

    {
      // Different button.
      await recorder.recorderPage.locator('.tab-locator .CodeMirror').pressSequentially(`Cancel' })`);
      await expect(recorder.page.locator('x-pw-highlight')).toBeVisible();
      const box1 = roundBox(await cancelButton.boundingBox());
      const box2 = roundBox(await recorder.page.locator('x-pw-highlight').boundingBox());
      expect(box1).toEqual(box2);
    }
  });
});
