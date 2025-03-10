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

function trimPatch(patch: string) {
  return patch.split('\n').map(line => line.trimEnd()).join('\n');
}

test('should update snapshot with the update-snapshots flag with multiple projects', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
    'playwright.config.ts': `
      export default { projects: [{ name: 'p1' }, { name: 'p2' }] };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello</h1><h2>bye</h2>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`
          - heading "world"
        \`);
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
+++ b/a.spec.ts
@@ -3,7 +3,8 @@
       test('test', async ({ page }) => {
         await page.setContent(\`<h1>hello</h1><h2>bye</h2>\`);
         await expect(page.locator('body')).toMatchAriaSnapshot(\`
-          - heading "world"
+          - heading "hello" [level=1]
+          - heading "bye" [level=2]
         \`);
       });

\\ No newline at end of file
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
    '.git/marker': '',
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: A snapshot is not provided, generating new baseline.');

  expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts

  git apply test-results/rebaselines.patch
`);

  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
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

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should update multiple missing snapshots', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
      });
    `
  });

  expect(result.exitCode).toBe(1);

  expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts

  git apply test-results/rebaselines.patch
`);

  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
+++ b/a.spec.ts
@@ -2,7 +2,11 @@
       import { test, expect } from '@playwright/test';
       test('test', async ({ page }) => {
         await page.setContent(\`<h1>hello</h1>\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - heading "hello" [level=1]
+        \`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - heading "hello" [level=1]
+        \`);
       });

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should generate baseline with regex', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
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

  expect(result.exitCode).toBe(1);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
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

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should generate baseline with special characters', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<ul>
          <details>
            <summary>one: <a href="#">link1</a> "two <a href="#">link2</a> 'three <a href="#">link3</a> \\\`four</summary>
          </details>
          <h1>heading "name" [level=1]</h1>
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

  expect(result.exitCode).toBe(1);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
+++ b/a.spec.ts
@@ -17,6 +17,30 @@
           <li>Item: 1</li>
           <li>Item {a: b}</li>
         </ul>\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - list:
+            - group:
+              - text: "one:"
+              - link "link1":
+                - /url: "#"
+              - text: "\\\\\"two"
+              - link "link2":
+                - /url: "#"
+              - text: "'three"
+              - link "link3":
+                - /url: "#"
+              - text: "\\\`four"
+            - heading "heading \\\\"name\\\\" [level=1]" [level=1]
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

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should update missing snapshots in tsx', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
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

  expect(result.exitCode).toBe(1);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/src/button.test.tsx b/src/button.test.tsx
--- a/src/button.test.tsx
+++ b/src/button.test.tsx
@@ -4,6 +4,8 @@

       test('pass', async ({ mount }) => {
         const component = await mount(<Button></Button>);
-        await expect(component).toMatchAriaSnapshot(\`\`);
+        await expect(component).toMatchAriaSnapshot(\`
+          - button \"Button\"
+        \`);
       });

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should update multiple files', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
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

  expect(result.exitCode).toBe(1);

  expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  src/button-1.test.tsx
  src/button-2.test.tsx

  git apply test-results/rebaselines.patch
`);

  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/src/button-1.test.tsx b/src/button-1.test.tsx
--- a/src/button-1.test.tsx
+++ b/src/button-1.test.tsx
@@ -4,6 +4,8 @@

       test('pass 1', async ({ mount }) => {
         const component = await mount(<Button></Button>);
-        await expect(component).toMatchAriaSnapshot(\`\`);
+        await expect(component).toMatchAriaSnapshot(\`
+          - button \"Button\"
+        \`);
       });

\\ No newline at end of file

diff --git a/src/button-2.test.tsx b/src/button-2.test.tsx
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

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should generate baseline for input values', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<input value="hello world">\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
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

\\ No newline at end of file
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should update when options are specified', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<input value="hello world">\`);
        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`, { timeout: 2500 });
        await expect(page.locator('body')).toMatchAriaSnapshot('',
          {
            timeout: 2500
          });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  const data = fs.readFileSync(patchPath, 'utf-8');
  expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
+++ b/a.spec.ts
@@ -2,8 +2,12 @@
       import { test, expect } from '@playwright/test';
       test('test', async ({ page }) => {
         await page.setContent(\`<input value="hello world">\`);
-        await expect(page.locator('body')).toMatchAriaSnapshot(\`\`, { timeout: 2500 });
-        await expect(page.locator('body')).toMatchAriaSnapshot('',
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - textbox: hello world
+        \`, { timeout: 2500 });
+        await expect(page.locator('body')).toMatchAriaSnapshot(\`
+          - textbox: hello world
+        \`,
           {
             timeout: 2500
           });
`);

  execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
  const result2 = await runInlineTest({});
  expect(result2.exitCode).toBe(0);
});

test('should not update snapshots when locator did not match', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    '.git/marker': '',
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent('<h1>hello</h1>');
        await expect(page.locator('div')).toMatchAriaSnapshot('- heading', { timeout: 3000 });
      });
    `,
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(1);
  const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
  expect(fs.existsSync(patchPath)).toBe(false);
  expect(result.output).not.toContain('New baselines created');
  expect(result.output).toContain('Expected: "- heading"');
  expect(result.output).toContain('Received: <element not found>');
});

test.describe('update-snapshots none', () => {
  test('should create new baseline for matching snapshot', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      '.git/marker': '',
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1><h1>world</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`\`);
        });
      `
    }, { 'update-snapshots': 'none' });

    expect(result.exitCode).toBe(1);
    const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
    expect(fs.existsSync(patchPath)).toBeFalsy();
  });
});

test.describe('update-snapshots all', () => {
  test('should create new baseline for matching snapshot', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      '.git/marker': '',
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1><h1>world</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
            - heading "hello"
          \`);
        });
      `
    }, { 'update-snapshots': 'all' });

    expect(result.exitCode).toBe(0);
    const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
    const data = fs.readFileSync(patchPath, 'utf-8');
    expect(trimPatch(data)).toBe(`diff --git a/a.spec.ts b/a.spec.ts
--- a/a.spec.ts
+++ b/a.spec.ts
@@ -3,7 +3,8 @@
         test('test', async ({ page }) => {
           await page.setContent(\`<h1>hello</h1><h1>world</h1>\`);
           await expect(page.locator('body')).toMatchAriaSnapshot(\`
-            - heading "hello"
+            - heading "hello" [level=1]
+            - heading "world" [level=1]
           \`);
         });

\\ No newline at end of file
`);

    expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts

  git apply test-results/rebaselines.patch
`);

    execSync(`patch -p1 < ${patchPath}`, { cwd: testInfo.outputPath() });
    const result2 = await runInlineTest({});
    expect(result2.exitCode).toBe(0);
  });
});

test.describe('update-source-method', () => {
  test('should overwrite source', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      '.git/marker': '',
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
            - heading "world"
          \`);
        });
      `
    }, { 'update-snapshots': 'all', 'update-source-method': 'overwrite' });

    expect(result.exitCode).toBe(0);
    const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
    expect(fs.existsSync(patchPath)).toBeFalsy();

    const data = fs.readFileSync(testInfo.outputPath('a.spec.ts'), 'utf-8');
    expect(data).toBe(`
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
            - heading "hello" [level=1]
          \`);
        });
      `);

    expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts
`);

    const result2 = await runInlineTest({});
    expect(result2.exitCode).toBe(0);
  });

  test('should 3way source', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      '.git/marker': '',
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
            - heading "world"
          \`);
        });
      `
    }, { 'update-snapshots': 'all', 'update-source-method': '3way' });

    expect(result.exitCode).toBe(0);
    const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
    expect(fs.existsSync(patchPath)).toBeFalsy();

    const data = fs.readFileSync(testInfo.outputPath('a.spec.ts'), 'utf-8');
    expect(data).toBe(`
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
\<<<<<<< HEAD
            - heading "world"
=======
            - heading "hello" [level=1]
>>>>>>> SNAPSHOT
          \`);
        });
      `);

    expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts
`);
  });

  test('should overwrite source when specified in the config', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      '.git/marker': '',
      'playwright.config.ts': `
        export default { updateSourceMethod: 'overwrite' };
      `,
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
            - heading "world"
          \`);
        });
      `
    }, { 'update-snapshots': 'all' });

    expect(result.exitCode).toBe(0);
    const patchPath = testInfo.outputPath('test-results/rebaselines.patch');
    expect(fs.existsSync(patchPath)).toBeFalsy();

    const data = fs.readFileSync(testInfo.outputPath('a.spec.ts'), 'utf-8');
    expect(data).toBe(`
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>hello</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot(\`
            - heading "hello" [level=1]
          \`);
        });
      `);

    expect(stripAnsi(result.output).replace(/\\/g, '/')).toContain(`New baselines created for:

  a.spec.ts
`);

    const result2 = await runInlineTest({});
    expect(result2.exitCode).toBe(0);
  });
});
