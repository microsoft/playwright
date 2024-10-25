/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import * as fs from 'fs';
import { test, expect } from './playwright-test-fixtures';

test.describe.configure({ mode: 'parallel' });

test('should update snapshot with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`
          - heading "world"
        \`);
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(data).toBe(`--- a/a.spec.ts
+++ b/a.spec.ts
@@ -3,7 +3,7 @@
       test('test', async ({ page }) => {
         await page.setContent(\`<h1>hello</h1>\`);
         await expect(page.locator('body')).toMatchAriaSnapshot(\`
-          - heading "world"
+          - heading "hello" [level=1]
         \`);
       });
     
`);
});

test('should update missing snapshots', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(data).toBe(`--- a/a.spec.ts
+++ b/a.spec.ts
@@ -2,6 +2,8 @@
       import { test, expect } from '@playwright/test';
       test('test', async ({ page }) => {
         await page.setContent(\`<h1>hello</h1>\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - heading "hello" [level=1]
+        \`);
       });
     
`);
});
