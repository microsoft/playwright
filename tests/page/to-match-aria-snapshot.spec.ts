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

import { stripAnsi } from '../config/utils';
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
  {
    await page.setContent(`<h1>Issues 12</h1>`);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading ${/Issues \d+/}
    `);
  }
  {
    await page.setContent(`<h1>Issues 1/2</h1>`);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading ${/Issues 1[/]2/}
    `);
  }
  {
    await page.setContent(`<h1>Issues 1[</h1>`);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading ${/Issues 1\[/}
    `);
  }
  {
    await page.setContent(`<h1>Issues 1]]2</h1>`);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading ${/Issues 1[\]]]2/}
    `);
  }
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
- Expected  - 1
+ Received  + 2

+ - banner:
    - heading "todos" [level=1]
- - textbox "Wrong text"
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
      <button>Click " me</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button "Click \\\" me"
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button /Click \" me/
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button /Click \\\" me/
    `);
  }

  {
    await page.setContent(`
      <button>Click \\ me</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button "Click \\\\ me"
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

  {
    await page.setContent(`
      <h1>heading "name" [level=1]</h1>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading "heading \\"name\\" [level=1]" [level=1]
    `);
  }

  {
    await page.setContent(`
      <h1>heading \\" [level=2]</h1>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - |
          heading    "heading \\\\\\" [level=2]" [
             level  =   1   ]
    `);
  }
});

test('should report error in YAML', async ({ page }) => {
  await page.setContent(`<h1>title</h1>`);

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      heading "title"
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Aria snapshot must be a YAML sequence, elements starting with " -"`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading: a:
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Nested mappings are not allowed in compact mappings at line 1, column 12:

- heading: a:
           ^
`);
  }
});

test('should report error in YAML keys', async ({ page }) => {
  await page.setContent(`<h1>title</h1>`);

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading "title
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Unterminated string:

heading "title
              ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading /title
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Unterminated regex:

heading /title
              ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [level=a]
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Value of "level" attribute must be a number:

heading [level=a]
               ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [expanded=FALSE]
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Value of "expanded" attribute must be a boolean:

heading [expanded=FALSE]
                  ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [checked=foo]
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Value of "checked" attribute must be a boolean or "mixed":

heading [checked=foo]
                 ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [level=]
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Value of "level" attribute must be a number:

heading [level=]
               ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading [bogus]
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Unsupported attribute [bogus]:

heading [bogus]
         ^
`);
  }

  {
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading invalid
    `).catch(e => e);
    expect.soft(error.message).toBe(`expect.toMatchAriaSnapshot: Unexpected input:

heading invalid
        ^
`);
  }
});

test('call log should contain actual snapshot', async ({ page }) => {
  await page.setContent(`<h1>todos</h1>`);
  const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "wrong"
  `, { timeout: 3000 }).catch(e => e);

  expect(stripAnsi(error.message)).toContain(`- unexpected value "- heading "todos" [level=1]"`);
});

test('should parse attributes', async ({ page }) => {
  {
    await page.setContent(`
      <button aria-pressed="mixed">hello world</button>
    `);
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button [pressed=mixed ]
    `);
  }

  {
    await page.setContent(`
      <h2>hello world</h2>
    `);
    await expect(page.locator('body')).not.toMatchAriaSnapshot(`
      - heading [level =  -3 ]
    `);
  }
});

test('should not unshift actual template text', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <h1>title 2</h1>
  `);
  const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
        - heading "title" [level=1]
    - heading "title 2" [level=1]
  `, { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`
    - heading "title" [level=1]
- heading "title 2" [level=1]`);
});

test('should not match what is not matched', async ({ page }) => {
  await page.setContent(`<p>Text</p>`);
  const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
    - paragraph:
      - button "bogus"
  `).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`
- - paragraph:
-   - button "bogus"
+ - paragraph: Text`);
});

test('should match url', async ({ page }) => {
  await page.setContent(`
    <a href='https://example.com'>Link</a>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - link:
      - /url: /.*example.com/
  `);
});

test('should detect unexpected children: equal', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </ul>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - listitem: "One"
      - listitem: "Three"
  `);

  const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - /children: equal
      - listitem: "One"
      - listitem: "Three"
  `, { timeout: 1000 }).catch(e => e);

  expect(e.message).toContain('Timed out 1000ms waiting');
  expect(stripAnsi(e.message)).toContain('+   - listitem: Two');
});

test('should detect unexpected children: deep-equal', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>
        <ul>
          <li>1.1</li>
          <li>1.2</li>
        </ul>
      </li>
    </ul>
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - list:
          - listitem: 1.1
  `);

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - /children: equal
      - listitem:
        - list:
          - listitem: 1.1
  `);

  const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - /children: deep-equal
      - listitem:
        - list:
          - listitem: 1.1
  `, { timeout: 1000 }).catch(e => e);

  expect(e.message).toContain('Timed out 1000ms waiting');
  expect(stripAnsi(e.message)).toContain('+       - listitem: \"1.2\"');
});

test('should allow restoring contain mode inside deep-equal', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>
        <ul>
          <li>1.1</li>
          <li>1.2</li>
        </ul>
      </li>
    </ul>
  `);

  const e = await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - /children: deep-equal
      - listitem:
        - list:
          - listitem: 1.1
  `, { timeout: 1000 }).catch(e => e);

  expect(e.message).toContain('Timed out 1000ms waiting');
  expect(stripAnsi(e.message)).toContain('+       - listitem: \"1.2\"');

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list:
      - /children: deep-equal
      - listitem:
        - list:
          - /children: contain
          - listitem: 1.1
  `);
});

test(`should only highlight regex patterns that don't match`, async ({ page }) => {
  await test.step('simple regex', async () => {
    await page.setContent(`
      <h1>Title 123</h1>
      <div>Content with value 456</div>
    `);

    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading /Title \\d+/
      - text: /Content with value \\d+/
      - text: "This text doesn't exist"
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
  - heading "Title 123" [level=1]
  - text: Content with value 456
- - text: "This text doesn't exist"`);
  });

  await test.step('nested regex', async () => {
    await page.setContent(`
      <ul>
        <li>
          <a href='about:blank'>Link 123</a>
        </li>
        <li>Another row</li>
        <li>One more row</li>
      </ul>
    `);

    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - list:
        - listitem:
          - link /Link \\d+/:
            - /url: about:blank
        - listitem: "One more row"
    `, { timeout: 1000 });

    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - list:
        - listitem:
          - link /Link2 \\d+/:
            - /url: about:blank
        - listitem: "One more row"
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
  - list:
    - listitem:
-     - link /Link2 \\d+/:
+     - link "Link 123":
        - /url: about:blank
-   - listitem: "One more row"
+   - listitem: Another row
+   - listitem: One more row`);
  });

  await test.step('regex with attributes', async () => {
    await page.setContent(`
      <h1>Title 123</h1>
      <h2>Heading 2 456</h2>
    `);

    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading /Title \\d+/ [level=1]
      - heading /Heading 2 \\d+/ [level=2]
      - text: "This text doesn't exist"
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
  - heading "Title 123" [level=1]
  - heading "Heading 2 456" [level=2]
- - text: "This text doesn't exist"`);

    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading /Title \\d+/
      - heading /Heading 2 \\d+/
    `, { timeout: 1000 });
  });
});

test(`should handle various regex failure scenarios`, async ({ page }) => {
  await test.step('regex with special characters', async () => {
    await page.setContent(`
      <div>Item A.1</div>
      <div>Item B*2</div>
      <p>This matches</p>
      <div>Ignored</div>
      <button>Submit+Now</button>
      <p>Parentheses (example)</p>
      <p>Brackets [example]</p>
    `);

    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - text: Item A.1 Item B*2
    `, { timeout: 1000 });

    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - text: /Item A\\\\.X Item B\\\\*2/
      - paragraph: This matches
      - button: /Submit\\\\?Now/
      - paragraph: /Parentheses \\\\(example\\\\)/
      - paragraph: /Brackets \\\\[example\\\\]/
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
- - text: /Item A\\\\.X Item B\\\\*2/
+ - text: Item A.1 Item B*2
  - paragraph: This matches
- - button: /Submit\\\\?Now/
+ - text: Ignored
+ - button "Submit+Now"
- - paragraph: /Parentheses \\\\(example\\\\)/
+ - paragraph: Parentheses (example)
- - paragraph: /Brackets \\\\[example\\\\]/
+ - paragraph: Brackets [example]`);
  });

  await test.step('regex case sensitivity', async () => {
    await page.setContent(`
      <h1>Hello World</h1>
      <p>another example</p>
    `);

    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading /hello world/
      - paragraph: /Another Example/
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
- - heading /hello world/
+ - heading "Hello World" [level=1]
- - paragraph: /Another Example/
+ - paragraph: another example`);
  });

  await test.step('name regex matches, attribute does not', async () => {
    await page.setContent(`
      <button aria-pressed="true">Action Button 007</button>
    `);
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button /Action Button \\d+/ [pressed=false]
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
Expected: \"- button /Action Button \\\\d+/ [pressed=false]\"
Received: \"- button \\"Action Button 007\\" [pressed]\"`);
  });

  await test.step('name regex mismatches, attribute matches', async () => {
    await page.setContent(`
      <h2 aria-level="2">Actual Section Title</h2>
    `);

    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - heading /Expected Section \\d+/ [level=2]
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
Expected: \"- heading /Expected Section \\\\d+/ [level=2]\"
Received: \"- heading \\\"Actual Section Title\\\" [level=2]\"`);
  });

  await test.step('name regex mismatches with an attribute', async () => {
    await page.setContent(`
      <button aria-pressed="true">Actual Button A</button>
      <button aria-pressed="true">Expected Button B</button>
    `);
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - button /NonExistent Button C/ [pressed]
      - button /Actual Button A/ [pressed=false]
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
- - button /NonExistent Button C/ [pressed]
+ - button "Actual Button A" [pressed]
- - button /Actual Button A/ [pressed=false]
+ - button "Expected Button B" [pressed]`);
  });

  await test.step('missing label', async () => {
    await page.setContent(`
      <div role="status" aria-label=""></div>
      <div role="row" aria-label="some label"></div>
      <button aria-label="">Submit</button>
      <img src="logo.png" alt="" />
    `);

    let error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - status /.+/
      - row /.+/
      - button /Submit/
      - image /.*/
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
- - status /.+/
+ - status
  - row "some label"
  - button "Submit"
- - image /.*/`);

    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - status
      - button "Submit"
    `, { timeout: 1000 });

    error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - status /^\$/
      - button /Submit/
      - image /^\$/
    `, { timeout: 1000 }).catch(e => e);

    expect(stripAnsi(error.message)).toContain(`
- - status /^\$/
+ - status
+ - row "some label"
  - button "Submit"
- - image /^\$/`);
  });

  await test.step('incorrect order', async () => {
    await page.setContent(`
      <p>Numeric 123</p>
      <p>Alpha ABC</p>
    `);

    // TODO: This error message could be better; while "Alpha ABC" is found, it is not the first element, which causes this confusing diff
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - paragraph: /Alpha [A-Z]+/
      - paragraph: /Numeric \\\\d+/
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`
- - paragraph: Alpha ABC
+ - paragraph: Numeric 123
- - paragraph: /Numeric \\\\d+/
+ - paragraph: Alpha ABC`);
  });

  await test.step('regex partially matches', async () => {
    await page.setContent(`
      <div>Product Code ABC-123-XYZ</div>
      <h1>Other text</h1>
    `);
    const error = await expect(page.locator('body')).toMatchAriaSnapshot(`
      - text: /Product Code [A-Z]{3}-\\d{3}-[A-Z]{4}/
    `, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain(`
- - text: /Product Code [A-Z]{3}-\\d{3}-[A-Z]{4}/
+ - text: Product Code ABC-123-XYZ
+ - heading "Other text" [level=1]`);
  });
});
