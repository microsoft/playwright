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

test('should generate baseline with regex', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Time 15:30</li>
          <li>Year 2022</li>
          <li>Duration 12ms</li>
          <li>22,333</li>
          <li>2,333.79</li>
          <li>Total 22</li>
          <li>/Regex 1/</li>
          <li>/Regex 22ms/</li>
        </ul>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(data).toBe(`--- a/a.spec.ts
+++ b/a.spec.ts
@@ -13,6 +13,18 @@
           <li>/Regex 1/</li>
           <li>/Regex 22ms/</li>
         </ul>\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - list:
+            - listitem: Item 1
+            - listitem: Item 2
+            - listitem: /Time \\d+:\\d+/
+            - listitem: /Year \\d+/
+            - listitem: /Duration \\d+[hms]+/
+            - listitem: /\\d+,\\d+/
+            - listitem: /2,\\d+\\.\\d+/
+            - listitem: /Total \\d+/
+            - listitem: /Regex 1/
+            - listitem: /\\/Regex \\d+[hms]+\\//
+        \`);
       });
     
`);
});

test('should generate baseline with special characters', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<ul>
          <button>Click: me</button>
          <li>Item: 1</li>
          <li>Item {a: b}</li>
        </ul>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(data).toBe(`--- a/a.spec.ts
+++ b/a.spec.ts
@@ -6,6 +6,11 @@
           <li>Item: 1</li>
           <li>Item {a: b}</li>
         </ul>\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - list:
+            - 'button "Click: me"'
+            - listitem: \"Item: 1\"
+            - listitem: \"Item {a: b}\"
+        \`);
       });
     
`);
});
