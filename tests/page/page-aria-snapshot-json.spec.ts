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

type NodeJSON = { role: string, name?: string, ref?: string, children?: (NodeJSON | string)[] } & Record<string, any>;

function findNode(nodes: (NodeJSON | string)[], predicate: (node: NodeJSON) => boolean): NodeJSON | undefined {
  for (const node of nodes) {
    if (typeof node === 'string')
      continue;
    if (predicate(node))
      return node;
    const result = findNode(node.children || [], predicate);
    if (result)
      return result;
  }
  return undefined;
}

it('should snapshot roles, names and text', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
    </ul>
  `);
  expect(await page.ariaSnapshotJSON()).toEqual([
    { role: 'heading', name: 'title', level: 1 },
    {
      role: 'list',
      name: 'my list',
      children: [
        { role: 'listitem', text: 'one' },
        { role: 'listitem', text: 'two' },
      ],
    },
  ]);
});

it('should snapshot flags as properties', async ({ page }) => {
  await page.setContent(`
    <input type="checkbox" title="Check" checked>
    <button disabled>Click</button>
  `);
  expect(await page.ariaSnapshotJSON()).toEqual([
    { role: 'checkbox', name: 'Check', checked: true },
    { role: 'button', name: 'Click', disabled: true },
  ]);
});

it('should snapshot link url and textbox value', async ({ page }) => {
  await page.setContent(`
    <a href="https://example.com/">Link</a>
    <input title="Input" value="hello">
  `);
  expect(await page.ariaSnapshotJSON()).toEqual([
    { role: 'link', name: 'Link', url: 'https://example.com/' },
    { role: 'textbox', name: 'Input', text: 'hello' },
  ]);
});

it('should snapshot text fragments in children', async ({ page }) => {
  await page.setContent(`<p>Hello <a href="/link">world</a> again</p>`);
  expect(await page.ariaSnapshotJSON()).toEqual([
    {
      role: 'paragraph',
      children: [
        'Hello',
        { role: 'link', name: 'world', url: '/link' },
        'again',
      ],
    },
  ]);
});

it('should generate refs in ai mode', async ({ page }) => {
  await page.setContent(`
    <button>One</button>
    <button>Two</button>
  `);
  expect(await page.ariaSnapshotJSON({ mode: 'ai' })).toEqual([
    {
      role: 'generic',
      active: true,
      ref: 'e1',
      children: [
        { role: 'button', name: 'One', ref: 'e2' },
        { role: 'button', name: 'Two', ref: 'e3' },
      ],
    },
  ]);
  await expect(page.locator('aria-ref=e2')).toHaveText('One');
});

it('should mark clickable elements with cursor in ai mode', async ({ page }) => {
  await page.setContent(`<button style="cursor: pointer">One</button>`);
  const json = await page.ariaSnapshotJSON({ mode: 'ai' }) as NodeJSON[];
  const button = findNode(json, node => node.role === 'button');
  expect(button?.cursor).toBe('pointer');
});

it('should snapshot iframes in ai mode', async ({ page }) => {
  await page.setContent(`
    <h1>Hello</h1>
    <iframe srcdoc="<button>In frame</button>"></iframe>
  `);
  const json = await page.ariaSnapshotJSON({ mode: 'ai' }) as NodeJSON[];
  const iframe = findNode(json, node => node.role === 'iframe');
  expect(iframe?.ref).toBeTruthy();
  const button = findNode(iframe!.children!, node => node.role === 'button');
  expect(button?.name).toBe('In frame');
  expect(button?.ref).toMatch(/^f\d+e\d+$/);
});

it('should limit depth', async ({ page }) => {
  await page.setContent(`<ul><li><button>One</button></li></ul>`);
  expect(await page.ariaSnapshotJSON({ depth: 1 })).toEqual([
    {
      role: 'list',
      children: [
        { role: 'listitem' },
      ],
    },
  ]);
});

it('should include boxes when requested', async ({ page }) => {
  await page.setContent(`<button>One</button>`);
  const json = await page.ariaSnapshotJSON({ boxes: true }) as NodeJSON[];
  const button = findNode(json, node => node.role === 'button');
  expect(button?.box).toEqual({
    x: expect.any(Number),
    y: expect.any(Number),
    width: expect.any(Number),
    height: expect.any(Number),
  });
  expect(button!.box.width).toBeGreaterThan(0);
  expect(button!.box.height).toBeGreaterThan(0);
});

it('should snapshot a locator', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <ul>
      <li>one</li>
      <li>two</li>
    </ul>
  `);
  expect(await page.locator('ul').ariaSnapshotJSON()).toEqual([
    {
      role: 'list',
      children: [
        { role: 'listitem', text: 'one' },
        { role: 'listitem', text: 'two' },
      ],
    },
  ]);
});
