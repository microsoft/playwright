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

import type { FrameLocator, Page } from '@playwright/test';
import { test as it, expect } from './pageTest';

const forAI = { _forAI: true } as any;

it('should generate refs', async ({ page }) => {
  await page.setContent(`
    <button>One</button>
    <button>Two</button>
    <button>Three</button>
  `);

  const snapshot1 = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot1).toContain('- button "One" [ref=s1e3]');
  expect(snapshot1).toContain('- button "Two" [ref=s1e4]');
  expect(snapshot1).toContain('- button "Three" [ref=s1e5]');

  await expect(page.locator('aria-ref=s1e3')).toHaveText('One');
  await expect(page.locator('aria-ref=s1e4')).toHaveText('Two');
  await expect(page.locator('aria-ref=s1e5')).toHaveText('Three');

  const snapshot2 = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot2).toContain('- button "One" [ref=s2e3]');
  await expect(page.locator('aria-ref=s2e3')).toHaveText('One');

  const e = await expect(page.locator('aria-ref=s1e3')).toHaveText('One').catch(e => e);
  expect(e.message).toContain('Error: Stale aria-ref, expected s2e{number}, got s1e3');
});

it('should list iframes', async ({ page }) => {
  await page.setContent(`
    <h1>Hello</h1>
    <iframe name="foo" src="data:text/html,<h1>World</h1>">
  `);

  const snapshot1 = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot1).toContain('- iframe');

  const frameSnapshot = await page.frameLocator(`iframe`).locator('body').ariaSnapshot();
  expect(frameSnapshot).toEqual('- heading "World" [level=1]');
});

it('ref mode can be used to stitch all frame snapshots', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/nested-frames.html');

  async function allFrameSnapshot(frame: Page | FrameLocator): Promise<string> {
    const snapshot = await frame.locator('body').ariaSnapshot(forAI);
    const lines = snapshot.split('\n');
    const result = [];
    for (const line of lines) {
      const match = line.match(/^(\s*)- iframe \[ref=(.*)\]/);
      if (!match) {
        result.push(line);
        continue;
      }

      const leadingSpace = match[1];
      const ref = match[2];
      const childFrame = frame.frameLocator(`aria-ref=${ref}`);
      const childSnapshot = await allFrameSnapshot(childFrame);
      result.push(line + ':', childSnapshot.split('\n').map(l => leadingSpace + '  ' + l).join('\n'));
    }
    return result.join('\n');
  }

  expect(await allFrameSnapshot(page)).toContainYaml(`
    - generic [ref=s1e2]:
      - iframe [ref=s1e3]:
        - generic [ref=s1e2]:
          - iframe [ref=s1e3]:
            - generic [ref=s1e3]: Hi, I'm frame
          - iframe [ref=s1e4]:
            - generic [ref=s1e3]: Hi, I'm frame
      - iframe [ref=s1e4]:
        - generic [ref=s1e3]: Hi, I'm frame
  `);
});

it('should not generate refs for hidden elements', async ({ page }) => {
  await page.setContent(`
    <button>One</button>
    <button style="width: 0; height: 0; appearance: none; border: 0; padding: 0;">Two</button>
    <button>Three</button>
  `);

  const snapshot = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot).toContainYaml(`
    - generic [ref=s1e2]:
      - button "One" [ref=s1e3]
      - button "Two"
      - button "Three" [ref=s1e5]
  `);
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

  const snapshot = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot).toContainYaml(`
    - generic [ref=s1e2]:
      - button "no-ref"
      - button "with-ref" [ref=s1e5]
      - button "with-ref" [ref=s1e8]
      - button "with-ref" [ref=s1e11]
      - generic [ref=s1e12]:
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

  const snapshot = await page.locator('body').ariaSnapshot(forAI);

  expect(snapshot).toContainYaml(`
    - generic [ref=s1e3]:
      - generic [ref=s1e4]:
        - generic [ref=s1e5]:
          - radio "Apple" [checked]
        - generic [ref=s1e7]: Apple
      - generic [ref=s1e8]:
        - generic [ref=s1e9]:
          - radio "Pear"
        - generic [ref=s1e11]: Pear
      - generic [ref=s1e12]:
        - generic [ref=s1e13]:
          - radio "Orange"
        - generic [ref=s1e15]: Orange
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

  const snapshot = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot).toContainYaml(`
    - button \"Button\" [ref=s1e6]
  `);
});

it('should include cursor pointer hint', async ({ page }) => {
  await page.setContent(`
    <button style="cursor: pointer">Button</button>
  `);

  const snapshot = await page.locator('body').ariaSnapshot(forAI);
  expect(snapshot).toContainYaml(`
    - button \"Button\" [ref=s1e3] [cursor=pointer]
  `);
});
