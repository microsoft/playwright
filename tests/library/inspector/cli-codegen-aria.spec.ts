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
import { roundBox } from '../../page/pageTest';

test.describe(() => {
  test.skip(({ mode }) => mode !== 'default');
  test.skip(({ trace, codegenMode }) => trace === 'on' && codegenMode === 'trace-events');

  test('should generate aria snapshot', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<main><button>Submit</button></main>`);

    await recorder.page.click('x-pw-tool-item.snapshot');
    await recorder.page.hover('button');
    await recorder.trustedClick();

    await expect.poll(() =>
      recorder.text('JavaScript')).toContain(`await expect(page.getByRole('button')).toMatchAriaSnapshot(\`- button "Submit"\`);`);
    await expect.poll(() =>
      recorder.text('Python')).toContain(`expect(page.get_by_role("button")).to_match_aria_snapshot("- button \\"Submit\\"")`);
    await expect.poll(() =>
      recorder.text('Python Async')).toContain(`await expect(page.get_by_role(\"button\")).to_match_aria_snapshot("- button \\"Submit\\"")`);
    await expect.poll(() =>
      recorder.text('Java')).toContain(`assertThat(page.getByRole(AriaRole.BUTTON)).matchesAriaSnapshot("- button \\"Submit\\"");`);
    await expect.poll(() =>
      recorder.text('C#')).toContain(`await Expect(page.GetByRole(AriaRole.Button)).ToMatchAriaSnapshotAsync("- button \\"Submit\\"");`);
  });

  test('should generate regex in aria snapshot', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<main><button>Submit 123</button></main>`);

    await recorder.page.click('x-pw-tool-item.snapshot');
    await recorder.page.hover('button');
    await recorder.trustedClick();

    await expect.poll(() =>
      recorder.text('JavaScript')).toContain(`await expect(page.getByRole('button')).toMatchAriaSnapshot(\`- button /Submit \\\\d+/\`);`);
    await expect.poll(() =>
      recorder.text('Python')).toContain(`expect(page.get_by_role("button")).to_match_aria_snapshot("- button /Submit \\\\d+/")`);
    await expect.poll(() =>
      recorder.text('Python Async')).toContain(`await expect(page.get_by_role(\"button\")).to_match_aria_snapshot("- button /Submit \\\\d+/")`);
    await expect.poll(() =>
      recorder.text('Java')).toContain(`assertThat(page.getByRole(AriaRole.BUTTON)).matchesAriaSnapshot("- button /Submit \\\\d+/");`);
    await expect.poll(() =>
      recorder.text('C#')).toContain(`await Expect(page.GetByRole(AriaRole.Button)).ToMatchAriaSnapshotAsync("- button /Submit \\\\d+/");`);
  });

  test('should inspect aria snapshot', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<main><button>Submit</button></main>`);
    await recorder.recorderPage.getByRole('button', { name: 'Record' }).click();
    await recorder.page.click('x-pw-tool-item.pick-locator');
    await recorder.page.hover('button');
    await recorder.trustedClick();
    await recorder.recorderPage.getByRole('tab', { name: 'Aria snapshot ' }).click();
    await expect(recorder.recorderPage.locator('.tab-aria .CodeMirror')).toMatchAriaSnapshot(`
      - textbox
      - text: '- button "Submit"'
    `);
  });

  test('should update aria snapshot highlight', async ({ openRecorder }) => {
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
    await recorder.recorderPage.getByRole('tab', { name: 'Aria snapshot ' }).click();
    await expect(recorder.recorderPage.locator('.tab-aria .CodeMirror')).toMatchAriaSnapshot(`
      - text: '- button "Submit"'
    `);

    await recorder.recorderPage.locator('.tab-aria .CodeMirror').click();
    for (let i = 0; i < '"Submit"'.length; i++)
      await recorder.recorderPage.keyboard.press('Backspace');

    {
      // No accessible name => two boxes.
      const box11 = roundBox(await submitButton.boundingBox());
      const box12 = roundBox(await recorder.page.locator('x-pw-highlight').first().boundingBox());
      expect(box11).toEqual(box12);

      const box21 = roundBox(await cancelButton.boundingBox());
      const box22 = roundBox(await recorder.page.locator('x-pw-highlight').last().boundingBox());
      expect(box21).toEqual(box22);
    }

    {
      // Different button.
      await recorder.recorderPage.locator('.tab-aria .CodeMirror').pressSequentially('"Cancel"');
      await expect(recorder.page.locator('x-pw-highlight')).toBeVisible();
      const box1 = roundBox(await cancelButton.boundingBox());
      const box2 = roundBox(await recorder.page.locator('x-pw-highlight').boundingBox());
      expect(box1).toEqual(box2);
    }
  });

  test('should show aria snapshot error', async ({ openRecorder }) => {
    const { recorder } = await openRecorder();
    await recorder.setContentAndWait(`<main>
      <button>Submit</button>
      <button>Cancel</button>
    </main>`);

    const submitButton = recorder.page.getByRole('button', { name: 'Submit' });
    await recorder.recorderPage.getByRole('button', { name: 'Record' }).click();

    await recorder.page.click('x-pw-tool-item.pick-locator');
    await submitButton.hover();
    await recorder.trustedClick();

    await recorder.recorderPage.getByRole('tab', { name: 'Aria snapshot ' }).click();
    await expect(recorder.recorderPage.locator('.tab-aria .CodeMirror')).toMatchAriaSnapshot(`
      - text: '- button "Submit"'
    `);

    await recorder.recorderPage.locator('.tab-aria .CodeMirror').click();
    await recorder.recorderPage.keyboard.press('Backspace');
    // 3 highlighted tokens.
    await expect(recorder.recorderPage.locator('.source-line-error-underline')).toHaveCount(3);
  });
});
