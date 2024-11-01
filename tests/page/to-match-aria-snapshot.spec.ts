/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { stripAnsi } from 'tests/config/utils';
import { test, expect } from './pageTest';

test('should match', async ({ page }) => {
  await page.setContent(`<h1>title</h1>`);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "title"
  `);
});

test('should match in list', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <h1>title 2</h1>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "title"
  `);
});

test('should match list with accessible name', async ({ page }) => {
  await page.setContent(`
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
    </ul>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list "my list":
      - listitem: "one"
      - listitem: "two"
  `);
});

test('should match deep item', async ({ page }) => {
  await page.setContent(`
    <div>
      <h1>title</h1>
      <h1>title 2</h1>
    </div>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "title"
  `);
});

test('should match complex', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>
        <a href='about:blank'>link</a>
      </li>
    </ul>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - link "link"
  `);
});

test('should match regex', async ({ page }) => {
  await page.setContent(`<h1>Issues 12</h1>`);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading ${/Issues \d+/}
  `);
});

test('should allow text nodes', async ({ page }) => {
  await page.setContent(`
    <h1>Microsoft</h1>
    <div>Open source projects and samples from Microsoft</div>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "Microsoft"
    - text: "Open source projects and samples from Microsoft"
  `);
});

test('details visibility', async ({ page }) => {
  await page.setContent(`
    <details>
      <summary>Summary</summary>
      <div>Details</div>
    </details>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - group: "Summary"
  `);
});

test('checked attribute', async ({ page }) => {
  await page.setContent(`
    <input type='checkbox' checked />
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - checkbox
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - checkbox [checked]
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - checkbox [checked=true]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - checkbox [checked=false]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - checkbox [checked=mixed]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - checkbox [checked=5]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain(' attribute must be a boolean or "mixed"');
  }
});

test('disabled attribute', async ({ page }) => {
  await page.setContent(`
    <button disabled>Click me</button>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [disabled]
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [disabled=true]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [disabled=false]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [disabled=invalid]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain(' attribute must be a boolean');
  }
});

test('expanded attribute', async ({ page }) => {
  await page.setContent(`
    <button aria-expanded="true">Toggle</button>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [expanded]
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [expanded=true]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [expanded=false]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [expanded=invalid]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain(' attribute must be a boolean');
  }
});

test('level attribute', async ({ page }) => {
  await page.setContent(`
    <h2>Section Title</h2>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading [level=2]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [level=3]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [level=two]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain(' attribute must be a number');
  }
});

test('pressed attribute', async ({ page }) => {
  await page.setContent(`
    <button aria-pressed="true">Like</button>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [pressed]
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [pressed=true]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [pressed=false]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  // Test for 'mixed' state
  await page.setContent(`
    <button aria-pressed="mixed">Like</button>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button [pressed=mixed]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [pressed=true]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [pressed=5]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain(' attribute must be a boolean or "mixed"');
  }
});

test('selected attribute', async ({ page }) => {
  await page.setContent(`
    <table>
      <tr aria-selected="true">
        <td>Row</td>
      </tr>
    </table>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - row
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - row [selected]
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - row [selected=true]
  `);

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - row [selected=false]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain('Timed out 1000ms waiting for expect');
  }

  {
    const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - row [selected=invalid]
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(e.message)).toContain(' attribute must be a boolean');
  }
});

test('integration test', async ({ page }) => {
  await page.setContent(`
    <h1>Microsoft</h1>
    <div>Open source projects and samples from Microsoft</div>
    <ul>
      <li>
        <details>
          <summary>
            Verified
          </summary>
          <div>
            <div>
              <p>
                We've verified that the organization <strong>microsoft</strong> controls the domain:
              </p>
              <ul>
                <li class="mb-1">
                  <strong>opensource.microsoft.com</strong>
                </li>
              </ul>
              <div>
                <a href="about: blank">Learn more about verified organizations</a>
              </div>
            </div>
          </div>
        </details>
      </li>
      <li>
        <a href="about:blank">
          <summary title="Label: GitHub Sponsor">Sponsor</summary>
        </a>
      </li>
    </ul>`);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "Microsoft"
    - text: Open source projects and samples from Microsoft
    - list:
      - listitem:
        - group: Verified
      - listitem:
        - link "Sponsor"
  `);
});

test('integration test 2', async ({ page }) => {
  await page.setContent(`
    <div>
      <header>
        <h1>todos</h1>
        <input placeholder="What needs to be done?">
      </header>
    </div>`);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "todos"
    - textbox "What needs to be done?"
  `);
});

test('expected formatter', async ({ page }) => {
  await page.setContent(`
    <div>
      <header>
        <h1>todos</h1>
        <input placeholder="What needs to be done?">
      </header>
    </div>`);
  const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "todos"
    - textbox "Wrong text"
  `, { timeout: 1 }).catch(e => e);

  expect(stripAnsi(error.message)).toContain(`
Locator: locator('body')
- Expected  - 2
+ Received  + 3

- - heading "todos"
- - textbox "Wrong text"
+ - banner:
+   - heading "todos" [level=1]
+   - textbox "What needs to be done?"`);
});

test('should unpack escaped names', async ({ page }) => {
  {
    await page.setContent(`
      <button>Click: me</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - 'button "Click: me"'
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - 'button /Click: me/'
    `);
  }

  {
    await page.setContent(`
      <button>Click / me</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button "Click / me"
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button /Click \\/ me/
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - 'button /Click \\/ me/'
    `);
  }

  {
    await page.setContent(`
      <button>Click \\ me</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button "Click \\ me"
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button /Click \\\\ me/
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - 'button /Click \\\\ me/'
    `);
  }

  {
    await page.setContent(`
      <button>Click ' me</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - 'button "Click '' me"'
    `);
  }
});
