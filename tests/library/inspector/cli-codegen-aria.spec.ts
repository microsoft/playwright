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
});
