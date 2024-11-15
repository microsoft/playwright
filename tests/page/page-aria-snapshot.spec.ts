/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import type { Locator } from '@playwright/test';
import { test as it, expect } from './pageTest';

function unshift(snapshot: string): string {
  const lines = snapshot.split('\n');
  let whitespacePrefixLength = 100;
  for (const line of lines) {
    if (!line.trim())
      continue;
    const match = line.match(/^(\s*)/);
    if (match && match[1].length < whitespacePrefixLength)
      whitespacePrefixLength = match[1].length;
  }
  return lines.filter(t => t.trim()).map(line => line.substring(whitespacePrefixLength)).join('\n');
}

async function checkAndMatchSnapshot(locator: Locator, snapshot: string) {
  expect.soft(await locator.ariaSnapshot()).toBe(unshift(snapshot));
  await expect.soft(locator).toMatchAriaSnapshot(snapshot);
}

it('should snapshot', async ({ page }) => {
  await page.setContent(`<h1>title</h1>`);
  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "title" [level=1]
  `);
});

it('should snapshot list', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <h1>title 2</h1>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "title" [level=1]
    - heading "title 2" [level=1]
  `);
});

it('should snapshot list with accessible name', async ({ page }) => {
  await page.setContent(`
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
    </ul>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - list "my list":
      - listitem: one
      - listitem: two
  `);
});

it('should snapshot complex', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>
        <a href='about:blank'>link</a>
      </li>
    </ul>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - list:
      - listitem:
        - link "link"
  `);
});

it('should allow text nodes', async ({ page }) => {
  await page.setContent(`
    <h1>Microsoft</h1>
    <div>Open source projects and samples from Microsoft</div>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "Microsoft" [level=1]
    - text: Open source projects and samples from Microsoft
  `);
});

it('should snapshot details visibility', async ({ page }) => {
  await page.setContent(`
    <details>
      <summary>Summary</summary>
      <div>Details</div>
    </details>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - group: Summary
  `);
});

it('should snapshot integration', async ({ page }) => {
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

  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "Microsoft" [level=1]
    - text: Open source projects and samples from Microsoft
    - list:
      - listitem:
        - group: Verified
      - listitem:
        - link "Sponsor"
  `);
});

it('should support multiline text', async ({ page }) => {
  await page.setContent(`
    <p>
      Line 1
      Line 2
      Line 3
    </p>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - paragraph: Line 1 Line 2 Line 3
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - paragraph: |
          Line 1
          Line 2
          Line 3
  `);
});

it('should concatenate span text', async ({ page }) => {
  await page.setContent(`
    <span>One</span> <span>Two</span> <span>Three</span>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - text: One Two Three
  `);
});

it('should concatenate span text 2', async ({ page }) => {
  await page.setContent(`
    <span>One </span><span>Two </span><span>Three</span>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - text: One Two Three
  `);
});

it('should concatenate div text with spaces', async ({ page }) => {
  await page.setContent(`
    <div>One</div><div>Two</div><div>Three</div>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - text: One Two Three
  `);
});

it('should include pseudo in text', async ({ page }) => {
  await page.setContent(`
    <style>
      span:before {
        content: 'world';
      }
      div:after {
        content: 'bye';
      }
    </style>
    <a href="about:blank">
      <span>hello</span>
      <div>hello</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "worldhello hellobye"
  `);
});

it('should not include hidden pseudo in text', async ({ page }) => {
  await page.setContent(`
    <style>
      span:before {
        content: 'world';
        display: none;
      }
      div:after {
        content: 'bye';
        visibility: hidden;
      }
    </style>
    <a href="about:blank">
      <span>hello</span>
      <div>hello</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "hello hello"
  `);
});

it('should include new line for block pseudo', async ({ page }) => {
  await page.setContent(`
    <style>
      span:before {
        content: 'world';
        display: block;
      }
      div:after {
        content: 'bye';
        display: block;
      }
    </style>
    <a href="about:blank">
      <span>hello</span>
      <div>hello</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "world hello hello bye"
  `);
});

it('should work with slots', async ({ page }) => {
  // Text "foo" is assigned to the slot, should not be used twice.
  await page.setContent(`
    <button><div>foo</div></button>
    <script>
      (() => {
        const container = document.querySelector('div');
        const shadow = container.attachShadow({ mode: 'open' });
        const slot = document.createElement('slot');
        shadow.appendChild(slot);
      })();
    </script>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - button "foo"
  `);

  // Text "foo" is assigned to the slot, should be used instead of slot content.
  await page.setContent(`
    <div>foo</div>
    <script>
      (() => {
        const container = document.querySelector('div');
        const shadow = container.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        shadow.appendChild(button);
        const slot = document.createElement('slot');
        button.appendChild(slot);
        const span = document.createElement('span');
        span.textContent = 'pre';
        slot.appendChild(span);
      })();
    </script>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - button "foo"
  `);

  // Nothing is assigned to the slot, should use slot content.
  await page.setContent(`
    <div></div>
    <script>
      (() => {
        const container = document.querySelector('div');
        const shadow = container.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        shadow.appendChild(button);
        const slot = document.createElement('slot');
        button.appendChild(slot);
        const span = document.createElement('span');
        span.textContent = 'pre';
        slot.appendChild(span);
      })();
    </script>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - button "pre"
  `);
});

it('should snapshot inner text', async ({ page }) => {
  await page.setContent(`
    <div role="listitem">
      <div>
        <div>
          <span title="a.test.ts">a.test.ts</span>
        </div>
        <div>
          <button title="Run"></button>
          <button title="Show source"></button>
          <button title="Watch"></button>
        </div>
      </div>
    </div>
    <div role="listitem">
      <div>
        <div>
          <span title="snapshot">snapshot</span>
        </div>
        <div class="ui-mode-list-item-time">30ms</div>
        <div>
          <button title="Run"></button>
          <button title="Show source"></button>
          <button title="Watch"></button>
        </div>
      </div>
    </div>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - listitem:
      - text: a.test.ts
      - button "Run"
      - button "Show source"
      - button "Watch"
    - listitem:
      - text: snapshot 30ms
      - button "Run"
      - button "Show source"
      - button "Watch"
  `);
});

it('should include pseudo codepoints', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <link href="codicon.css" rel="stylesheet" />
    <p class='codicon codicon-check'>hello</p>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - paragraph: \ueab2hello
  `);
});

it('check aria-hidden text', async ({ page }) => {
  await page.setContent(`
    <p>
      <span>hello</span>
      <span aria-hidden="true">world</span>
    </p>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - paragraph: hello
  `);
});

it('should ignore presentation and none roles', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li role='presentation'>hello</li>
      <li role='none'>world</li>
    </ul>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - list: hello world
  `);
});

it('should treat input value as text in templates', async ({ page }) => {
  await page.setContent(`
    <input value='hello world'>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - textbox: hello world
  `);
});

it('should respect aria-owns', async ({ page }) => {
  await page.setContent(`
    <a href='about:blank' aria-owns='input p'>
      <div role='region'>Link 1</div>
    </a>
    <a href='about:blank' aria-owns='input p'>
      <div role='region'>Link 2</div>
    </a>
    <input id='input' value='Value'>
    <p id='p'>Paragraph</p>
  `);

  // - Different from Chrome DevTools which attributes ownership to the last element.
  // - CDT also does not include non-owned children in accessible name.
  // - Disregarding these as aria-owns can't suggest multiple parts by spec.
  await checkAndMatchSnapshot(page.locator('body'), `
    - link "Link 1 Value Paragraph":
      - region: Link 1
      - textbox: Value
      - paragraph: Paragraph
    - link "Link 2 Value Paragraph":
      - region: Link 2
  `);
});

it('should be ok with circular ownership', async ({ page }) => {
  await page.setContent(`
    <a href='about:blank' id='parent'>
      <div role='region' aria-owns='parent'>Hello</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "Hello":
      - region: Hello
  `);
});

it('should escape yaml text in text nodes', async ({ page }) => {
  await page.setContent(`
    <details>
      <summary>one: <a href="#">link1</a> "two <a href="#">link2</a> 'three <a href="#">link3</a> \`four</summary>
    </details>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - group:
      - text: "one:"
      - link "link1"
      - text: "\\\"two"
      - link "link2"
      - text: "'three"
      - link "link3"
      - text: "\`four"
  `);
});

it('should handle long strings', async ({ page }) => {
  const s = 'a'.repeat(10000);
  await page.setContent(`
    <a href='about:blank'>
      <div role='region'>${s}</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link:
      - region: ${s}
  `);
});
