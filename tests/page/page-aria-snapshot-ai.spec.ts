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

function snapshotForAI(page: any): Promise<string> {
  return page._snapshotForAI();
}

it('should generate refs', async ({ page }) => {
  await page.setContent(`
    <button>One</button>
    <button>Two</button>
    <button>Three</button>
  `);

  const snapshot1 = await snapshotForAI(page);
  expect(snapshot1).toContainYaml(`
    - generic [ref=e1]:
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
    - generic [ref=e1]:
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
    - generic [ref=e1]:
      - iframe [ref=e2]:
        - generic [ref=f1e1]:
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
    const locator = await (page.locator('aria-ref=e1') as any)._generateLocatorString();
    expect(locator).toBe(`locator('body')`);
  }
  {
    const locator = await (page.locator('aria-ref=f3e2') as any)._generateLocatorString();
    expect(locator).toBe(`locator('iframe[name="2frames"]').contentFrame().locator('iframe[name="dos"]').contentFrame().getByText('Hi, I\\'m frame')`);
  }
  {
    // Should tolerate .describe().
    const locator = await (page.locator('aria-ref=f2e2').describe('foo bar') as any)._generateLocatorString();
    expect(locator).toBe(`locator('iframe[name=\"2frames\"]').contentFrame().locator('iframe[name=\"uno\"]').contentFrame().getByText('Hi, I\\'m frame')`);
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
    - generic [ref=e1]:
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
    - generic [ref=e1]:
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
