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
import { test, expect, playwrightCtConfigText, stripAnsi } from './playwright-test-fixtures';
import { execSync } from 'child_process';

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

  expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts

  git apply test-results/rebaselines.patch
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
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

  expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts

  git apply test-results/rebaselines.patch
`);

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

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
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
+            - listitem: /Time \\\\d+:\\\\d+/
+            - listitem: /Year \\\\d+/
+            - listitem: /Duration \\\\d+[hmsp]+/
+            - listitem: /\\\\d+,\\\\d+/
+            - listitem: /\\\\d+,\\\\d+\\\\.\\\\d+/
+            - listitem: /Total \\\\d+/
+            - listitem: /Regex 1/
+            - listitem: /\\\\/Regex \\\\d+[hmsp]+\\\\//
+        \`);
       });
     
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should generate baseline with special characters', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<ul>
          <button>Click: me</button>
          <button>Click: 123</button>
          <button>Click ' me</button>
          <button>Click: ' me</button>
          <button>Click " me</button>
          <button>Click " me 123</button>
          <button>Click \\\\ me</button>
          <button>Click \\\\ me 123</button>
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
@@ -13,6 +13,18 @@
           <li>Item: 1</li>
           <li>Item {a: b}</li>
         </ul>\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - list:
+            - 'button "Click: me"'
+            - 'button /Click: \\\\d+/'
+            - button "Click ' me"
+            - 'button "Click: '' me"'
+            - button "Click \\\\" me"
+            - button /Click " me \\\\d+/
+            - button "Click \\\\\\\\ me"
+            - button /Click \\\\\\\\ me \\\\d+/
+            - listitem: \"Item: 1\"
+            - listitem: \"Item {a: b}\"
+        \`);
       });
     
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should update missing snapshots in tsx', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,

    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button.tsx';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toMatchAriaSnapshot(\`\`);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(data).toBe(`--- a/src/button.test.tsx
+++ b/src/button.test.tsx
@@ -4,6 +4,8 @@
 
       test('pass', async ({ mount }) => {
         const component = await mount(<Button></Button>);
-        await expect(component).toMatchAriaSnapshot(\`\`);
+        await expect(component).toMatchAriaSnapshot(\`
+          - button \"Button\"
+        \`);
       });
     
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should update multiple files', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,

    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button-1.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button.tsx';

      test('pass 1', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toMatchAriaSnapshot(\`\`);
      });
    `,

    'src/button-2.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button.tsx';

      test('pass 2', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toMatchAriaSnapshot(\`\`);
      });
    `,
  });

  expect(result.exitCode).toBe(0);

  expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  src/button-1.test.tsx
  src/button-2.test.tsx

  git apply test-results/rebaselines.patch
`);

  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(data).toBe(`--- a/src/button-1.test.tsx
+++ b/src/button-1.test.tsx
@@ -4,6 +4,8 @@
 
       test('pass 1', async ({ mount }) => {
         const component = await mount(<Button></Button>);
-        await expect(component).toMatchAriaSnapshot(\`\`);
+        await expect(component).toMatchAriaSnapshot(\`
+          - button \"Button\"
+        \`);
       });
     

--- a/src/button-2.test.tsx
+++ b/src/button-2.test.tsx
@@ -4,6 +4,8 @@
 
       test('pass 2', async ({ mount }) => {
         const component = await mount(<Button></Button>);
-        await expect(component).toMatchAriaSnapshot(\`\`);
+        await expect(component).toMatchAriaSnapshot(\`
+          - button \"Button\"
+        \`);
       });
     
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should generate baseline for input values', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<input value="hello world">\`);
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
         await page.setContent(\`<input value="hello world">\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - textbox: hello world
+        \`);
       });
     
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});
