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


import { test as it, expect } from './pageTest';
import { unshift } from '../config/utils';
import type { Page } from 'playwright-core';

async function snapshotForAI(page: Page, options?: Omit<Parameters<Page['ariaSnapshot']>[0], 'mode'>): Promise<string> {
  return await page.ariaSnapshot({ ...options, mode: 'ai' });
}

it('should generate refs', async ({ page }) => {
  await page.setContent(`
    <button>One</button>
    <button>Two</button>
    <button>Three</button>
  `);

  const snapshot1 = await snapshotForAI(page);
  expect(snapshot1).toContainYaml(`
    - generic [active] [ref=e1]:
      - button "One" [ref=e2]
      - button "Two" [ref=e3]
      - button "Three" [ref=e4]
  `);
  await expect(page.locator('aria-ref=e2')).toHaveText('One');
  await expect(page.locator('aria-ref=e3')).toHaveText('Two');
  await expect(page.locator('aria-ref=e4')).toHaveText('Three');

  await page.locator('aria-ref=e3').evaluate((e: HTMLElement) => {
    e.textContent = 'Not Two';
  });

  const snapshot2 = await snapshotForAI(page);
  expect(snapshot2).toContainYaml(`
    - generic [active] [ref=e1]:
      - button "One" [ref=e2]
      - button "Not Two" [ref=e5]
      - button "Three" [ref=e4]
  `);
});

it('should list iframes', async ({ page }) => {
  await page.setContent(`
    <h1>Hello</h1>
    <iframe name="foo" src="data:text/html,<h1>World</h1>">
  `);

  const snapshot1 = await snapshotForAI(page);
  expect(snapshot1).toContain('- iframe');

  const frameSnapshot = await page.frameLocator(`iframe`).locator('body').ariaSnapshot();
  expect(frameSnapshot).toEqual('- heading "World" [level=1]');
});

it('should snapshot a locator inside an iframe', async ({ page }) => {
  await page.setContent(`
    <h1>Main Page</h1>
    <iframe srcdoc="<ul><li>Item 1</li><li>Item 2</li></ul>"></iframe>
  `);

  const list = page.frames()[1].locator('ul');
  const snapshot = await list.ariaSnapshot({ mode: 'ai' });
  expect(snapshot).toContainYaml(`
    - list [ref=f1e1]:
      - listitem [ref=f1e2]: Item 1
      - listitem [ref=f1e3]: Item 2
  `);
});

it('should limit depth across iframe boundary', async ({ page }) => {
  await page.setContent(`
    <nav>
      <iframe srcdoc="<ul><li><button>Deep</button></li></ul>"></iframe>
    </nav>
  `);

  const snapshot = await snapshotForAI(page, { depth: 3 });
  expect(snapshot).toContainYaml(`
    - navigation [ref=e2]:
      - iframe [ref=e3]:
        - list [ref=f1e2]:
          - listitem [ref=f1e3]
  `);
  expect(snapshot).not.toContain('button');
});

it('should stitch all frame snapshots', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - iframe [ref=e2]:
        - generic [active] [ref=f1e1]:
          - iframe [ref=f1e2]:
            - generic [ref=f3e2]: Hi, I'm frame
          - iframe [ref=f1e3]:
            - generic [ref=f4e2]: Hi, I'm frame
      - iframe [ref=e3]:
        - generic [ref=f2e2]: Hi, I'm frame
  `);

  const href = await page.locator('aria-ref=e1').evaluate(e => e.ownerDocument.defaultView.location.href);
  expect(href).toBe(server.PREFIX + '/frames/nested-frames.html');

  const href2 = await page.locator('aria-ref=f1e2').evaluate(e => e.ownerDocument.defaultView.location.href);
  expect(href2).toBe(server.PREFIX + '/frames/two-frames.html');

  const href3 = await page.locator('aria-ref=f4e2').evaluate(e => e.ownerDocument.defaultView.location.href);
  expect(href3).toBe(server.PREFIX + '/frames/frame.html');

  {
    const resolved = await page.locator('aria-ref=e1').normalize();
    expect(resolved.toString()).toBe(`locator('body')`);
  }
  {
    const resolved = await page.locator('aria-ref=f4e2').normalize();
    expect(resolved.toString()).toBe(`locator('iframe[name="2frames"]').contentFrame().locator('iframe[name="dos"]').contentFrame().getByText('Hi, I\\'m frame')`);
  }
  {
    // Should tolerate .describe().
    const resolved = await page.locator('aria-ref=f3e2').describe('foo bar').normalize();
    expect(resolved.toString()).toBe(`locator('iframe[name=\"2frames\"]').contentFrame().locator('iframe[name=\"uno\"]').contentFrame().getByText('Hi, I\\'m frame')`);
  }
  {
    const error = await page.locator('aria-ref=e1000').normalize().catch(e => e);
    expect(error.message).toContain(`No element matching aria-ref=e1000`);
  }
});

it('should re-number refs across navigations but not same-document navigations', async ({ page, server }) => {
  server.setRoute('/one.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<button>One</button>');
  });
  server.setRoute('/two.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<button>Two</button>');
  });

  // The first committed document keeps the base seq, so the main frame has no prefix.
  await page.goto(server.PREFIX + '/one.html');
  const oneRef = (await snapshotForAI(page)).match(/button "One" \[ref=(e\d+)\]/)![1];
  await expect(page.locator(`aria-ref=${oneRef}`)).toHaveText('One');

  // Cross-document navigation re-numbers the main frame, so its refs gain a frame prefix.
  await page.goto(server.PREFIX + '/two.html');
  const twoRef = (await snapshotForAI(page)).match(/button "Two" \[ref=(f\d+e\d+)\]/)![1];
  await expect(page.locator(`aria-ref=${twoRef}`)).toHaveText('Two');

  // The stale ref from the previous document must not resolve against the new one.
  const error = await page.locator(`aria-ref=${oneRef}`).normalize().catch(e => e);
  expect(error.message).toContain(`No element matching aria-ref=${oneRef}`);

  // Same-document navigation keeps refs intact.
  await page.evaluate(() => history.pushState({}, '', '/pushed.html'));
  expect(await snapshotForAI(page)).toContain(`button "Two" [ref=${twoRef}]`);
  await expect(page.locator(`aria-ref=${twoRef}`)).toHaveText('Two');
});

it('should persist iframe references', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li><iframe srcdoc="<button>button1</button>"></iframe></li>
      <li><iframe srcdoc="<button>button2</button>"></iframe></li>
    </ul>
  `);
  expect(await snapshotForAI(page)).toContainYaml(`
    - list [ref=e2]:
      - listitem [ref=e3]:
        - iframe [ref=e4]:
          - button "button1" [ref=f1e2]
      - listitem [ref=e5]:
        - iframe [ref=e6]:
          - button "button2" [ref=f2e2]
  `);

  await page.evaluate(() => document.querySelector('iframe').remove());
  expect(await snapshotForAI(page)).toContainYaml(`
    - list [ref=e2]:
      - listitem [ref=e3]
      - listitem [ref=e5]:
        - iframe [ref=e6]:
          - button "button2" [ref=f2e2]
  `);
  await expect(page.locator('aria-ref=f2e2')).toHaveText('button2');

  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.setAttribute('srcdoc', '<button>button1</button>');
    document.querySelector('li').appendChild(frame);
  });
  expect(await snapshotForAI(page)).toContainYaml(`
    - list [ref=e2]:
      - listitem [ref=e3]:
        - iframe [ref=e7]:
          - button "button1" [ref=f3e2]
      - listitem [ref=e5]:
        - iframe [ref=e6]:
          - button "button2" [ref=f2e2]
  `);
  await expect(page.locator('aria-ref=f3e2')).toHaveText('button1');
  await expect(page.locator('aria-ref=f2e2')).toHaveText('button2');
});

it('should not generate refs for elements with pointer-events:none', async ({ page }) => {
  await page.setContent(`
    <button style="pointer-events: none">no-ref</button>
    <div style="pointer-events: none">
      <button style="pointer-events: auto">with-ref</button>
    </div>
    <div style="pointer-events: none">
      <div style="pointer-events: initial">
        <button>with-ref</button>
      </div>
    </div>
    <div style="pointer-events: none">
      <div style="pointer-events: auto">
        <button>with-ref</button>
      </div>
    </div>
    <div style="pointer-events: auto">
      <div style="pointer-events: none">
        <button>no-ref</button>
      </div>
    </div>
  `);

  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - button "no-ref"
      - button "with-ref" [ref=e2]
      - button "with-ref" [ref=e4]
      - button "with-ref" [ref=e6]
      - generic [ref=e7]:
        - generic:
          - button "no-ref"
  `);
});

it('emit generic roles for nodes w/o roles', async ({ page }) => {
  await page.setContent(`
    <style>
    input {
      width: 0;
      height: 0;
      opacity: 0;
    }
    </style>
    <div>
      <label>
        <span>
          <input type="radio" value="Apple" checked="">
        </span>
        <span>Apple</span>
      </label>
      <label>
        <span>
          <input type="radio" value="Pear">
        </span>
        <span>Pear</span>
      </label>
      <label>
        <span>
          <input type="radio" value="Orange">
        </span>
        <span>Orange</span>
      </label>
    </div>
  `);

  const snapshot = await snapshotForAI(page);

  expect(snapshot).toContainYaml(`
    - generic [ref=e2]:
      - generic [ref=e3]:
        - generic [ref=e4]:
          - radio "Apple" [checked]
        - text: Apple
      - generic [ref=e5]:
        - generic [ref=e6]:
          - radio "Pear"
        - text: Pear
      - generic [ref=e7]:
        - generic [ref=e8]:
          - radio "Orange"
        - text: Orange
  `);
});

it('should collapse generic nodes', async ({ page }) => {
  await page.setContent(`
    <div>
      <div>
        <div>
          <button>Button</button>
        </div>
      </div>
    </div>
  `);

  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - button \"Button\" [ref=e5]
  `);
});

it('should include cursor pointer hint', async ({ page }) => {
  await page.setContent(`
    <button style="cursor: pointer">Button</button>
  `);

  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - button \"Button\" [ref=e2] [cursor=pointer]
  `);
});

it('should not nest cursor pointer hints', async ({ page }) => {
  await page.setContent(`
    <a style="cursor: pointer" href="about:blank">
      Link with a button
      <button style="cursor: pointer">Button</button>
    </a>
  `);

  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - link \"Link with a button Button\" [ref=e2] [cursor=pointer]:
      - /url: about:blank
      - text: Link with a button
      - button "Button" [ref=e3]
  `);
});

it('should truncate data url in link', async ({ page }) => {
  const base64 = Buffer.from('<p>hello</p>').toString('base64');
  await page.setContent(`<a href="data:text/html;base64,${base64}">a link</a>`);
  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContain('/url: data:text/html;base64,…');
  expect(snapshot).not.toContain(base64);
});

it('should gracefully fallback when child frame cant be captured', async ({ page, server }) => {
  await page.setContent(`
    <p>Test</p>
    <iframe src="${server.PREFIX}/redirectloop1.html#depth=100000"></iframe>
  `, { waitUntil: 'domcontentloaded' });
  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - paragraph [ref=e2]: Test
      - iframe [ref=e3]
  `);
});

it('should auto-wait for navigation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/frame.html');
  const [, snapshot] = await Promise.all([
    page.evaluate(() => window.location.reload()),
    snapshotForAI(page)
  ]);
  // The snapshot races the reload, which may re-number the main frame, so accept any ref.
  expect(snapshot).toMatch(/- generic \[ref=(?:f\d+)?e\d+\]: Hi, I'm frame/);
});

it('should auto-wait for blocking CSS', async ({ page, server }) => {
  server.setRoute('/css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    setTimeout(() => res.end(`body { monospace }`), 1000);
  });
  await page.setContent(`
    <script src="${server.PREFIX}/css"></script>
    <p>Hello World</p>
  `, { waitUntil: 'commit' });
  expect(await snapshotForAI(page)).toContainYaml('Hello World');
});

it('should show visible children of hidden elements', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36296' }  }, async ({ page }) => {
  await page.setContent(`
    <div style="visibility: hidden">
      <div style="visibility: visible">
        <button>Visible</button>
      </div>
      <div style="visibility: hidden">
        <button style="visibility: visible">Visible</button>
      </div>
      <div>
        <div style="visibility: visible">
          <button style="visibility: hidden">Hidden</button>
        </div>
        <button>Hidden</button>
      </div>
    </div>
  `);

  expect(await snapshotForAI(page)).toEqual(unshift(`
    - generic [active] [ref=e1]:
      - button "Visible" [ref=e3]
      - button "Visible" [ref=e4]
  `));
});

it('should include active element information', async ({ page }) => {
  await page.setContent(`
    <button id="btn1">Button 1</button>
    <button id="btn2" autofocus>Button 2</button>
    <div>Not focusable</div>
  `);

  // Wait for autofocus to take effect
  await page.waitForFunction(() => document.activeElement?.id === 'btn2');

  const snapshot = await snapshotForAI(page);

  expect(snapshot).toContainYaml(`
    - generic [ref=e1]:
      - button "Button 1" [ref=e2]
      - button "Button 2" [active] [ref=e3]
      - generic [ref=e4]: Not focusable
  `);
});

it('should update active element on focus', async ({ page }) => {
  await page.setContent(`
    <input id="input1" placeholder="First input">
    <input id="input2" placeholder="Second input">
  `);

  // Initially there shouldn't be an active element on the inputs
  const initialSnapshot = await snapshotForAI(page);
  expect(initialSnapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - textbox "First input" [ref=e2]
      - textbox "Second input" [ref=e3]
  `);

  // Focus the second input
  await page.locator('#input2').focus();

  // After focus, the second input should be active
  const afterFocusSnapshot = await snapshotForAI(page);

  expect(afterFocusSnapshot).toContainYaml(`
    - generic [ref=e1]:
      - textbox "First input" [ref=e2]
      - textbox "Second input" [active] [ref=e3]
  `);
});

it('should mark iframe as active when it contains focused element', async ({ page }) => {
  // Create a simple HTML file for the iframe
  await page.setContent(`
    <input id="regular-input" placeholder="Regular input">
    <iframe src="data:text/html,<input id='iframe-input' placeholder='Input in iframe'>" tabindex="0"></iframe>
  `);

  // Test 1: Focus the input inside the iframe
  await page.frameLocator('iframe').locator('#iframe-input').focus();
  const inputInIframeFocusedSnapshot = await snapshotForAI(page);

  // The iframe should be marked as active when it contains a focused element
  expect(inputInIframeFocusedSnapshot).toContainYaml(`
    - generic [ref=e1]:
      - textbox "Regular input" [ref=e2]
      - iframe [active] [ref=e3]:
        - textbox "Input in iframe" [active] [ref=f1e2]
  `);
});

it('return empty snapshot when iframe is not loaded', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/pull/36710' } }, async ({ page, server }) => {
  await page.setContent(`
    <div style="height: 5000px;">Test</div>
    <iframe loading="lazy" src="${server.PREFIX}/frame.html"></iframe>
  `);

  // Wait for the iframe to load
  await page.waitForSelector('iframe');

  // Get the snapshot of the page
  const snapshot = await snapshotForAI(page, { timeout: 3000 });

  // The iframe should be present but empty
  expect(snapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - generic [ref=e2]: Test
      - iframe [ref=e3]
  `);
});

it('should support many properties on iframes', async ({ page }) => {
  await page.setContent(`
    <input id="regular-input" placeholder="Regular input">
    <iframe style='cursor: pointer' src="data:text/html,<input id='iframe-input' placeholder='Input in iframe'/>" tabindex="0"></iframe>
  `);

  // Test 1: Focus the input inside the iframe
  await page.frameLocator('iframe').locator('#iframe-input').focus();
  const inputInIframeFocusedSnapshot = await snapshotForAI(page);

  expect(inputInIframeFocusedSnapshot).toContainYaml(`
    - generic [ref=e1]:
      - textbox "Regular input" [ref=e2]
      - iframe [active] [ref=e3] [cursor=pointer]:
        - textbox "Input in iframe" [active] [ref=f1e2]
  `);
});

it('should collapse inline generic nodes', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li><b>3</b> <abbr>bds</abbr></li>
      <li><b>2</b> <abbr>ba</abbr></li>
      <li><b>1,200</b> <abbr>sqft</abbr></li>
    </ul>
    <ul>
      <li><div>3</div></li>
      <li><div>2</div></li>
      <li><div>1,200</div></li>
    </ul>`);

  const snapshot1 = await snapshotForAI(page);
  expect(snapshot1).toContainYaml(`
    - generic [active] [ref=e1]:
      - list [ref=e2]:
        - listitem [ref=e3]: 3 bds
        - listitem [ref=e4]: 2 ba
        - listitem [ref=e5]: 1,200 sqft
      - list [ref=e6]:
        - listitem [ref=e7]:
          - generic [ref=e8]: "3"
        - listitem [ref=e9]:
          - generic [ref=e10]: "2"
        - listitem [ref=e11]:
          - generic [ref=e12]: 1,200
  `);
});

it('should not remove generic nodes with title', async ({ page }) => {
  await page.setContent(`<div title="Element title">Element content</div>`);

  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - generic "Element title" [ref=e2]
  `);
});

it('should limit depth', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>item1</li>
      <a href="about:blank" style="cursor:pointer">link</a>
      <li>
        <ul id=target>
          <li>item2</li>
          <li>
            <ul>
              <li>item3</li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>
  `);

  const snapshot1 = await snapshotForAI(page, { depth: 1 });
  expect(snapshot1).toContainYaml(`
    - list [ref=e2]:
      - listitem [ref=e3]: item1
      - link "link" [ref=e4] [cursor=pointer]:
        - /url: about:blank
      - listitem [ref=e5]
  `);

  const snapshot2 = await snapshotForAI(page, { depth: 3 });
  expect(snapshot2).toContainYaml(`
    - list [ref=e2]:
      - listitem [ref=e3]: item1
      - link "link" [ref=e4] [cursor=pointer]:
        - /url: about:blank
      - listitem [ref=e5]:
        - list [ref=e6]:
          - listitem [ref=e7]: item2
          - listitem [ref=e8]
  `);

  const snapshot3 = await snapshotForAI(page, { depth: 100 });
  expect(snapshot3).toContainYaml(`
    - list [ref=e2]:
      - listitem [ref=e3]: item1
      - link "link" [ref=e4] [cursor=pointer]:
        - /url: about:blank
      - listitem [ref=e5]:
        - list [ref=e6]:
          - listitem [ref=e7]: item2
          - listitem [ref=e8]:
            - list [ref=e9]:
              - listitem [ref=e10]: item3
  `);

  const snapshot4 = await page.locator('#target').ariaSnapshot({ mode: 'ai', depth: 1 });
  expect(snapshot4).toContainYaml(`
    - list [ref=e6]:
      - listitem [ref=e7]: item2
      - listitem [ref=e8]
  `);
});
