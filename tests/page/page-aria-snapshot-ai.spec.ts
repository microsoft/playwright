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

// @ts-ignore
import { asLocator } from 'playwright-core/lib/utils';

import { test as it, expect, unshift } from './pageTest';

function snapshotForAI(page: any, options?: { timeout?: number }): Promise<string> {
  return page._snapshotForAI(options);
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

it('should stitch all frame snapshots', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  const snapshot = await snapshotForAI(page);
  expect(snapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - iframe [ref=e2]:
        - generic [active] [ref=f1e1]:
          - iframe [ref=f1e2]:
            - generic [ref=f2e2]: Hi, I'm frame
          - iframe [ref=f1e3]:
            - generic [ref=f3e2]: Hi, I'm frame
      - iframe [ref=e3]:
        - generic [ref=f4e2]: Hi, I'm frame
  `);

  const href = await page.locator('aria-ref=e1').evaluate(e => e.ownerDocument.defaultView.location.href);
  expect(href).toBe(server.PREFIX + '/frames/nested-frames.html');

  const href2 = await page.locator('aria-ref=f1e2').evaluate(e => e.ownerDocument.defaultView.location.href);
  expect(href2).toBe(server.PREFIX + '/frames/two-frames.html');

  const href3 = await page.locator('aria-ref=f3e2').evaluate(e => e.ownerDocument.defaultView.location.href);
  expect(href3).toBe(server.PREFIX + '/frames/frame.html');

  {
    const { resolvedSelector } = await (page.locator('aria-ref=e1') as any)._resolveSelector();
    const sourceCode = asLocator('javascript', resolvedSelector);
    expect(sourceCode).toBe(`locator('body')`);
  }
  {
    const { resolvedSelector } = await (page.locator('aria-ref=f3e2') as any)._resolveSelector();
    const sourceCode = asLocator('javascript', resolvedSelector);
    expect(sourceCode).toBe(`locator('iframe[name="2frames"]').contentFrame().locator('iframe[name="dos"]').contentFrame().getByText('Hi, I\\'m frame')`);
  }
  {
    // Should tolerate .describe().
    const { resolvedSelector } = await (page.locator('aria-ref=f2e2').describe('foo bar') as any)._resolveSelector();
    const sourceCode = asLocator('javascript', resolvedSelector);
    expect(sourceCode).toBe(`locator('iframe[name=\"2frames\"]').contentFrame().locator('iframe[name=\"uno\"]').contentFrame().getByText('Hi, I\\'m frame')`);
  }
  {
    const error = await (page.locator('aria-ref=e1000') as any)._resolveSelector().catch(e => e);
    expect(error.message).toContain(`No element matching aria-ref=e1000`);
  }
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
      - button "with-ref" [ref=e4]
      - button "with-ref" [ref=e7]
      - button "with-ref" [ref=e10]
      - generic [ref=e11]:
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
        - generic [ref=e6]: Apple
      - generic [ref=e7]:
        - generic [ref=e8]:
          - radio "Pear"
        - generic [ref=e10]: Pear
      - generic [ref=e11]:
        - generic [ref=e12]:
          - radio "Orange"
        - generic [ref=e14]: Orange
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
  expect(snapshot).toContainYaml(`
    - generic [ref=e2]: Hi, I'm frame
  `);
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
  const snapshot = await snapshotForAI(page, { timeout: 100 });

  // The iframe should be present but empty
  expect(snapshot).toContainYaml(`
    - generic [active] [ref=e1]:
      - generic [ref=e2]: Test
      - iframe [ref=e3]
  `);
});
