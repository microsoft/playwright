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

import { test, expect } from '@playwright/test';
import { parseAriaSnapshotUnsafe, diffAriaSnapshots } from '../../../packages/playwright-core/lib/utils/isomorphic/ariaSnapshot.js';
import { yaml } from 'playwright-core/lib/utilsBundle';

function addSource(text: string, node: any) {
  if (node.sourceRange)
    node.source = text.slice(node.sourceRange.from, node.sourceRange.to).trim();
  if (node.subtreeSourceRange)
    node.subtreeSource = text.slice(node.subtreeSourceRange.from, node.subtreeSourceRange.to).trim();
  (node.children || []).forEach(child => addSource(text, child));
}

function parse(text: string) {
  const result = parseAriaSnapshotUnsafe(yaml, text, { laxProps: true });
  addSource(text, result);
  return result;
}

function diff(oldSnapshot: string, newSnapshot: string) {
  const diffs = diffAriaSnapshots(yaml, oldSnapshot, newSnapshot);
  if (Array.isArray(diffs))
    diffs.forEach(diff => diff.newSource = diff.newSource.trimEnd());
  return diffs;
}

test('parse aria snapshot returns source ranges', () => {
  const listSnapshot = `list "list name" [ref=e1]:
  - listitem: item 1
  - listitem "item 2":
    - button "click me" [ref=e2]
    - text: hello
  - listitem:
    - generic: text1
    - generic [ref=e3] [active] [cursor=pointer]: text2`;

  const snapshot = `
- ${listSnapshot}
- button "another button" [ref=e4]
`;

  expect(parse(snapshot)).toEqual(expect.objectContaining({
    role: 'fragment',
    source: '',
    subtreeSource: snapshot.trim(),
    children: [
      expect.objectContaining({
        role: 'list',
        name: 'list name',
        props: { ref: expect.objectContaining({ raw: 'e1' }) },
        source: 'list "list name" [ref=e1]',
        subtreeSource: listSnapshot,
        children: [
          expect.objectContaining({
            role: 'listitem',
            source: 'listitem',
            subtreeSource: 'listitem: item 1',
            children: [
              expect.objectContaining({
                kind: 'text',
                text: expect.objectContaining({ raw: 'item 1' }),
                source: 'item 1',
              }),
            ],
          }),
          expect.objectContaining({
            role: 'listitem',
            name: 'item 2',
            source: 'listitem "item 2"',
            subtreeSource: 'listitem "item 2":\n    - button "click me" [ref=e2]\n    - text: hello',
            children: [
              expect.objectContaining({
                role: 'button',
                name: 'click me',
                props: { ref: expect.objectContaining({ raw: 'e2' }) },
                source: 'button "click me" [ref=e2]',
              }),
              expect.objectContaining({
                kind: 'text',
                text: expect.objectContaining({ raw: 'hello' }),
                source: 'text: hello',
              }),
            ],
          }),
          expect.objectContaining({
            role: 'listitem',
            source: 'listitem',
            subtreeSource: 'listitem:\n    - generic: text1\n    - generic [ref=e3] [active] [cursor=pointer]: text2',
            children: [
              expect.objectContaining({
                role: 'generic',
                source: 'generic',
                subtreeSource: 'generic: text1',
                children: [
                  expect.objectContaining({
                    kind: 'text',
                    text: expect.objectContaining({ raw: 'text1' }),
                    source: 'text1',
                  }),
                ],
              }),
              expect.objectContaining({
                role: 'generic',
                props: { ref: expect.objectContaining({ raw: 'e3' }), cursor: expect.objectContaining({ raw: 'pointer' }) },
                active: true,
                source: 'generic [ref=e3] [active] [cursor=pointer]',
                subtreeSource: 'generic [ref=e3] [active] [cursor=pointer]: text2',
                children: [
                  expect.objectContaining({
                    kind: 'text',
                    text: expect.objectContaining({ raw: 'text2' }),
                    source: 'text2',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({
        role: 'button',
        name: 'another button',
        props: { ref: expect.objectContaining({ raw: 'e4' }) },
        source: 'button "another button" [ref=e4]',
      }),
    ],
  }));
});

test('diff: equal', () => {
  expect(diff(`- button "name"`, `- button "name"`)).toBe('equal');
});

test('diff: different', () => {
  expect(diff(`- button "name"`, `- button "new name"`)).toBe('different');
});

test('diff: one ref', () => {
  expect(diff(`
- button "button 1" [ref=e1]
`, `
- button "button 2" [ref=e1]
`)).toEqual([
    {
      ref: 'e1',
      newSource: 'button "button 2" [ref=e1]',
    }
  ]);
});

test('diff: no ref upgrades to parent', () => {
  expect(diff(`
- listitem [ref=e6]:
  - generic: some text
`, `
- listitem [ref=e6]:
  - generic: some text has changed
`)).toEqual([
    {
      ref: 'e6',
      newSource: `listitem [ref=e6]:
  - generic: some text has changed`,
    }
  ]);
});

test('diff: two refs in a large parent', () => {
  expect(diff(`
- listitem [ref=e6]: some text
- listitem
- listitem
- listitem
- listitem
- listitem
- listitem
- listitem
- listitem [ref=e7]: other text
`, `
- listitem [ref=e6]: some new text
- listitem
- listitem
- listitem
- listitem
- listitem
- listitem
- listitem
- listitem [ref=e7]: other new text
`)).toEqual([
    {
      ref: 'e6',
      newSource: `listitem [ref=e6]: some new text`,
    },
    {
      ref: 'e7',
      newSource: `listitem [ref=e7]: other new text`,
    },
  ]);
});

test('diff: mixed', () => {
  const snapshot1 = `
  - button "button 1" [ref=e1] [active]
  - button "padding"
  - button "button 2" [ref=e2]
  - button "padding"
  - button "padding"
  - list "list name" [ref=e3]:
    - listitem [ref=e4]: item 1
    - listitem "item 2" [ref=e5]
    - button "padding"
    - button "padding"
    - button "padding"
    - button "padding"
    - listitem [ref=e6]:
      - generic: some text
    - button "padding"
    - button "padding"
    - button "padding"
    - button "padding"
    - generic:
      - listitem [ref=e10]: more text
    - listitem "item name" [ref=e7]
    - listitem [ref=e8]:
      - listitem "deep item" [ref=e9]
  `;
  const snapshot2 = `
  - button "button 1" [ref=e1]
  - button "padding"
  - button "button 2" [ref=e2] [active]
  - button "padding"
  - button "padding"
  - list "list name" [ref=e3]:
    - listitem [ref=e4]: item 1
    - listitem "item 2" [ref=e5]:
      - button "new button 1" [ref=e100]
    - button "padding"
    - button "padding"
    - button "padding"
    - button "padding"
    - listitem [ref=e6]:
      - generic: some text has changed
    - button "padding"
    - button "padding"
    - button "padding"
    - button "padding"
    - generic:
      - listitem [ref=e10]: more text has changed
    - listitem "new item name" [ref=e7]
    - listitem [ref=e8]:
      - listitem "new ref" [ref=e101]
  `;
  expect(diff(snapshot1, snapshot2)).toEqual([
    { ref: 'e1', newSource: 'button "button 1" [ref=e1]' },
    { ref: 'e2', newSource: 'button "button 2" [ref=e2] [active]' },
    { ref: 'e5', newSource: `listitem "item 2" [ref=e5]:
      - button "new button 1" [ref=e100]` },
    { ref: 'e6', newSource: `listitem [ref=e6]:
      - generic: some text has changed` },
    { ref: 'e10', newSource: 'listitem [ref=e10]: more text has changed' },
    { ref: 'e7', newSource: `listitem "new item name" [ref=e7]` },
    { ref: 'e8', newSource: `listitem [ref=e8]:
      - listitem "new ref" [ref=e101]` },
  ]);
});

test('diff: two refs in a small parent are combined', () => {
  expect(diff(`
- button "name"
- list [ref=e1]:
  - listitem [ref=e6]: some text
  - listitem
  - listitem
  - listitem
  - listitem [ref=e7]: other text
`, `
- button "name"
- list [ref=e1]:
  - listitem [ref=e6]: some new text
  - listitem
  - listitem
  - listitem
  - listitem [ref=e7]: other new text
`)).toEqual([
    {
      ref: 'e1',
      newSource: `list [ref=e1]:
  - listitem [ref=e6]: some new text
  - listitem
  - listitem
  - listitem
  - listitem [ref=e7]: other new text`,
    },
  ]);
});
