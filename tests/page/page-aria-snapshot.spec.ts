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

import type { Locator } from '@playwright/test';
import { test as it, expect } from './pageTest';
import { unshift } from '../config/utils';

async function checkAndMatchSnapshot(locator: Locator, snapshot: string) {
  expect.soft(await locator.ariaSnapshot()).toBe(unshift(snapshot));
  await expect.soft(locator).toMatchAriaSnapshot(snapshot);
}

it('AR-001 should snapshot', async ({ page }) => {
  await page.setContent(`<h1>title</h1>`);
  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "title" [level=1]
  `);
});

it('AR-002 should snapshot list', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <h1>title 2</h1>
  `);
  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "title" [level=1]
    - heading "title 2" [level=1]
  `);
});

it('AR-003 should snapshot list with accessible name', async ({ page }) => {
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

it('AR-004 should quote names that look like regexes', async ({ page }) => {
  await page.setContent(`
    <nav>
      <a href="/">/</a>
      <a href="/docs/">/docs/</a>
      <a href="/a(b/">/a(b/</a>
    </nav>
  `);
  await checkAndMatchSnapshot(page.locator('nav'), `
    - navigation:
      - link "/":
        - /url: /
      - link "/docs/":
        - /url: /docs/
      - link "/a(b/":
        - /url: /a(b/
  `);
});

it('AR-005 should snapshot complex', async ({ page }) => {
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
        - link "link":
          - /url: about:blank
  `);
});

it('AR-006 should allow text nodes', async ({ page }) => {
  await page.setContent(`
    <h1>Microsoft</h1>
    <div>Open source projects and samples from Microsoft</div>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "Microsoft" [level=1]
    - text: Open source projects and samples from Microsoft
  `);
});

it('AR-007 should snapshot details visibility', async ({ page }) => {
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

it('AR-008 should not snapshot text directly inside closed details', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43019' });

  await page.setContent(`
    <details>
      <summary>Summary</summary>
      Details
    </details>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - group: Summary
  `);

  await page.$eval('details', details => details.open = true);
  await checkAndMatchSnapshot(page.locator('body'), `
    - group: Summary Details
  `);
});

it('AR-009 should not snapshot text that is not assigned to a slot', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43019' });

  await page.setContent(`
    <div role=button>Light</div>
    <script>
      document.querySelector('div').attachShadow({ mode: 'open' }).innerHTML = '<p>Shadow</p>';
    </script>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - button "Shadow":
      - paragraph: Shadow
  `);
  await expect(page.getByRole('button', { name: 'Shadow', exact: true })).toBeVisible();
});

it('AR-010 should snapshot integration', async ({ page }) => {
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
        - link "Sponsor":
          - /url: about:blank
  `);
});

it('AR-011 should support multiline text', async ({ page }) => {
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

it('AR-012 should concatenate span text', async ({ page }) => {
  await page.setContent(`
    <span>One</span> <span>Two</span> <span>Three</span>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - text: One Two Three
  `);
});

it('AR-013 should concatenate span text 2', async ({ page }) => {
  await page.setContent(`
    <span>One </span><span>Two </span><span>Three</span>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - text: One Two Three
  `);
});

it('AR-014 should concatenate div text with spaces', async ({ page }) => {
  await page.setContent(`
    <div>One</div><div>Two</div><div>Three</div>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - text: One Two Three
  `);
});

it('AR-015 should include pseudo in text', async ({ page }) => {
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
    - link "worldhello hellobye":
      - /url: about:blank
  `);
});

it('AR-016 should not include hidden pseudo in text', async ({ page }) => {
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
    - link "hello hello":
      - /url: about:blank
  `);
});

it('AR-017 should include new line for block pseudo', async ({ page }) => {
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
    - link "world hello hello bye":
      - /url: about:blank
  `);
});

it('AR-018 should work with slots', async ({ page }) => {
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

it('AR-019 should snapshot inner text', async ({ page }) => {
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

it('AR-020 should include pseudo codepoints', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <link href="codicon.css" rel="stylesheet" />
    <p class='codicon codicon-check'>hello</p>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - paragraph: \ueab2hello
  `);
});

it('AR-021 check aria-hidden text', async ({ page }) => {
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

it('AR-022 should ignore presentation and none roles', async ({ page }) => {
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

it('AR-023 should treat input value as text in templates, but not for checkbox/radio/file', async ({ page }) => {
  await page.setContent(`
    <input value='hello world'>
    <input type=file>
    <input type=checkbox checked>
    <input type=radio checked>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - textbox: hello world
    - button "Choose File"
    - checkbox [checked]
    - radio [checked]
  `);
});

it('AR-024 should not use on as checkbox value', async ({ page }) => {
  await page.setContent(`
    <input type='checkbox'>
    <input type='radio'>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - checkbox
    - radio
  `);
});

it('AR-025 should respect aria-owns', async ({ page }) => {
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
      - /url: about:blank
      - region: Link 1
      - textbox: Value
      - paragraph: Paragraph
    - link "Link 2 Value Paragraph":
      - /url: about:blank
      - region: Link 2
  `);
});

it('AR-026 should be ok with circular ownership', async ({ page }) => {
  await page.setContent(`
    <a href='about:blank' id='parent'>
      <div role='region' aria-owns='parent'>Hello</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "Hello":
      - /url: about:blank
      - region: Hello
  `);
});

it('AR-027 should escape yaml text in text nodes', async ({ page }) => {
  await page.setContent(`
    <details>
      <summary>one: <a href="#">link1</a> "two <a href="#">link2</a> 'three <a href="#">link3</a> \`four</summary>
    </details>
    <ul>
      <a href="#">one</a>,<a href="#">two</a>
      (<a href="#">three</a>)
      {<a href="#">four</a>}
      [<a href="#">five</a>]
    </ul>
    <div>[Select all]</div>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - group:
      - text: "one:"
      - link "link1":
        - /url: "#"
      - text: "\\\"two"
      - link "link2":
        - /url: "#"
      - text: "'three"
      - link "link3":
        - /url: "#"
      - text: "\`four"
    - list:
      - link "one":
        - /url: "#"
      - text: ","
      - link "two":
        - /url: "#"
      - text: (
      - link "three":
        - /url: "#"
      - text: ") {"
      - link "four":
        - /url: "#"
      - text: "} ["
      - link "five":
        - /url: "#"
      - text: "]"
    - text: "[Select all]"
  `);
});

it('AR-028 should normalize whitespace', async ({ page }) => {
  await page.setContent(`
    <details>
      <summary> one  \n two <a href="#"> link &nbsp;\n  1 </a> </summary>
    </details>
    <input value='  hello   &nbsp; world '>
    <button>hello\u00ad\u200bworld</button>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - group:
      - text: one two
      - link "link 1":
        - /url: "#"
    - textbox: hello world
    - button "helloworld"
  `);

  // Weird whitespace in the template should be normalized.
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - group:
      - text: |
          one
          two
      - link "  link     1 ":
        - /url: "#"
    - textbox:        hello  world
    - button "he\u00adlloworld\u200b"
  `);
});

it('AR-029 should handle long strings', async ({ page }) => {
  const s = 'a'.repeat(10000);
  await page.setContent(`
    <a href='about:blank'>
      <div role='region'>${s}</div>
    </a>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link:
      - /url: about:blank
      - region: ${s}
  `);
});

it('AR-030 should escape special yaml characters', async ({ page }) => {
  await page.setContent(`
    <a href="#">@hello</a>@hello
    <a href="#">]hello</a>]hello
    <a href="#">hello\n</a>
    hello\n<a href="#">\n hello</a>\n hello
    <a href="#">#hello</a>#hello
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "@hello":
      - /url: "#"
    - text: "@hello"
    - link "]hello":
      - /url: "#"
    - text: "]hello"
    - link "hello":
      - /url: "#"
    - text: hello
    - link "hello":
      - /url: "#"
    - text: hello
    - link "#hello":
      - /url: "#"
    - text: "#hello"
  `);
});

it('AR-031 should escape special yaml values', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43451' },
}, async ({ page }) => {
  await page.setContent(`
    <a href="#">true</a>False
    <a href="#">NO</a>yes
    <a href="#">y</a>N
    <a href="#">on</a>Off
    <a href="#">null</a>NULL
    <a href="#">123</a>123
    <a href="#">-1.2</a>-1.2
    <a href="#">-</a>-
    <a href="#">~</a>~
    <a href="#">.inf</a>.NaN
    <input type=text value="555">
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - link "true":
      - /url: "#"
    - text: "False"
    - link "NO":
      - /url: "#"
    - text: "yes"
    - link "y":
      - /url: "#"
    - text: "N"
    - link "on":
      - /url: "#"
    - text: "Off"
    - link "null":
      - /url: "#"
    - text: "NULL"
    - link "123":
      - /url: "#"
    - text: "123"
    - link "-1.2":
      - /url: "#"
    - text: "-1.2"
    - link "-":
      - /url: "#"
    - text: "-"
    - link "~":
      - /url: "#"
    - text: "~"
    - link ".inf":
      - /url: "#"
    - text: ".NaN"
    - textbox: "555"
  `);
});

it('AR-032 should not report textarea textContent', async ({ page }) => {
  await page.setContent(`<textarea>Before</textarea>`);
  await checkAndMatchSnapshot(page.locator('body'), `
    - textbox: Before
  `);
  await page.evaluate(() => {
    document.querySelector('textarea').value = 'After';
  });
  await checkAndMatchSnapshot(page.locator('body'), `
    - textbox: After
  `);
});

it('AR-033 should not show visible children of hidden elements', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36296' }  }, async ({ page }) => {
  await page.setContent(`
    <div style="visibility: hidden;">
      <div style="visibility: visible;">
        <button>Button</button>
      </div>
    </div>
  `);

  expect(await page.locator('body').ariaSnapshot()).toBe('');
});

it('AR-034 should not show unhidden children of aria-hidden elements', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36296' }  }, async ({ page }) => {
  await page.setContent(`
    <div aria-hidden="true">
      <div aria-hidden="false">
        <button>Button</button>
      </div>
    </div>
  `);

  expect(await page.locator('body').ariaSnapshot()).toBe('');
});

it('AR-035 should snapshot placeholder when different from the name', async ({ page }) => {
  await page.setContent(`
    <input placeholder="Placeholder">
  `);
  expect(await page.locator('body').ariaSnapshot()).toContainYaml(`
    - textbox "Placeholder"
  `);

  await page.setContent(`
    <input placeholder="Placeholder" aria-label="Label">
  `);
  expect(await page.locator('body').ariaSnapshot()).toContainYaml(`
    - textbox "Label":
      - /placeholder: Placeholder
  `);
});

it('AR-036 match values both against regex and string', async ({ page }) => {
  await page.setContent(`<a href="/auth?r=/">Log in</a>`);
  await checkAndMatchSnapshot(page.locator('body'), `
    - link "Log in":
      - /url: /auth?r=/
  `);
});

it('AR-037 auto-waits the locator and does not include iframes', async ({ page }) => {
  await page.setContent(`
    <div>Hello</div>
  `);

  const snapshotPromise = page.locator('#target').ariaSnapshot();
  await page.waitForTimeout(2000);
  await page.setContent(`
    <div id=target>
      Hello
      <iframe srcdoc="<ul><li>Item 1</li><li>Item 2</li></ul>"></iframe>
    </div>
  `);
  expect(await snapshotPromise).toContainYaml(`
    - text: Hello
  `);
});

it('AR-038 should limit depth', async ({ page }) => {
  await page.setContent(`
    <ul id=target>
      <li>item2</li>
      <li>
        <ul>
          <li>item3</li>
        </ul>
      </li>
    </ul>
  `);

  const snapshot = await page.locator('#target').ariaSnapshot({ depth: 1 });
  expect(snapshot).toContainYaml(`
    - list:
      - listitem: item2
      - listitem
  `);
});

it('AR-039 should snapshot a locator inside an iframe', async ({ page }) => {
  await page.setContent(`
    <h1>Main Page</h1>
    <iframe srcdoc="<ul><li>Item 1</li><li>Item 2</li></ul>"></iframe>
  `);

  const list = page.frames()[1].locator('ul');
  const snapshot = await list.ariaSnapshot();
  expect(snapshot).toContainYaml(`
    - list:
      - listitem: Item 1
      - listitem: Item 2
  `);
});

it('AR-040 should include frames on frameset pages', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41784' } }, async ({ page, server }) => {
  server.setRoute('/frameset.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<frameset cols="50%,50%"><frame src="/frames/frame.html"><frame src="/frames/frame.html"></frameset>`);
  });
  await page.goto(server.PREFIX + '/frameset.html');
  // Like iframes, frames are listed in the snapshot, but their content is not included.
  expect(await page.ariaSnapshot({ timeout: 3000 })).toBe(unshift(`
    - iframe
    - iframe
  `));
});

it('AR-041 should snapshot a locator inside a frameset frame', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/frameset.html');
  await checkAndMatchSnapshot(page.frameLocator('frame').first().locator('body'), `
    - text: Hi, I'm frame
  `);
});

it('AR-042 should snapshot with box from page', async ({ page }) => {
  await page.setContent(`
    <button style="position:absolute;left:100px;top:50px;width:80px;height:40px;margin:0;padding:0;border:0;">click</button>
  `);

  const snapshot = await page.ariaSnapshot({ boxes: true });
  expect(snapshot).toBe(`- button "click" [box=100,50,80,40]`);
});

it('AR-043 should snapshot with box from locator', async ({ page }) => {
  await page.setContent(`
    <div style="position:absolute;left:10px;top:20px;width:200px;height:100px;">
      <button style="position:absolute;left:5px;top:5px;width:60px;height:30px;margin:0;padding:0;border:0;">ok</button>
    </div>
  `);

  const snapshot = await page.locator('div').ariaSnapshot({ boxes: true });
  expect(snapshot).toBe(`- button "ok" [box=15,25,60,30]`);
});

it('AR-044 should not include box when option is omitted', async ({ page }) => {
  await page.setContent(`<button>click</button>`);
  const snapshot = await page.ariaSnapshot();
  expect(snapshot).not.toMatch(/\[box=/);
});

it('AR-045 should not include hidden iframes', async ({ page }) => {
  await page.setContent(`
    <iframe name="visible" srcdoc="<button>Visible</button>"></iframe>
    <iframe name="hidden" style="visibility: hidden" srcdoc="<button>Hidden</button>"></iframe>
    <iframe name="none" style="display: none" srcdoc="<button>None</button>"></iframe>
  `);
  expect(await page.ariaSnapshot()).toBe(unshift(`
    - iframe
  `));
});

it('AR-046 should not include inert elements', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36938' } }, async ({ page }) => {
  await page.setContent(`
    <button>Hi</button>
    <button inert>Hello</button>
    <div inert>
      <button>Yay</button>
      <p>Some text</p>
    </div>
    <p>Visible <span inert>inert</span> text</p>
    <button><span inert>Save</span></button>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - button "Hi"
    - paragraph: Visible text
    - button
  `);
});

it('AR-047 should only include the modal dialog content', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36938' } }, async ({ page }) => {
  await page.setContent(`
    <h1>Title</h1>
    <button>Outside</button>
    <dialog id=dialog>
      <h2>Dialog</h2>
      <button>Inside</button>
      <div inert><button>Inert inside</button></div>
    </dialog>
    <script>
      document.getElementById('dialog').showModal();
    </script>
  `);

  await checkAndMatchSnapshot(page.locator('body'), `
    - dialog:
      - heading "Dialog" [level=2]
      - button "Inside"
  `);

  await page.locator('#dialog').evaluate((e: HTMLDialogElement) => e.close());
  await checkAndMatchSnapshot(page.locator('body'), `
    - heading "Title" [level=1]
    - button "Outside"
  `);
});
