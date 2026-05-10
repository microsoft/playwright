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
import { SnapshotRenderer } from '../../packages/isomorphic/trace/snapshotRenderer';
import { LRUCache } from '../../packages/isomorphic/lruCache';
import type { FrameSnapshot } from '../../packages/trace/src/snapshot';

function makeSnapshot(overrides: Partial<FrameSnapshot> = {}): FrameSnapshot {
  return {
    callId: 'call-1',
    pageId: 'page-1',
    frameId: 'frame-1',
    frameUrl: 'http://example.com/',
    timestamp: 0,
    collectionTime: 0,
    html: ['HTML', {}, ['BODY', {}]],
    resourceOverrides: [],
    viewport: { width: 1280, height: 720 },
    isMainFrame: true,
    ...overrides,
  };
}

for (const [name, overrides] of [
  ['callId', { callId: '</script><script>window.__pwned__=true;//' }],
  ['snapshotName', { callId: 'call-1', snapshotName: '</script><img src=x onerror=alert(1)>' }],
] as const) {
  test(`snapshot renderer escapes attacker-controlled ${name} in script context`, () => {
    const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot(overrides)], [], 0);
    const { html } = renderer.render();
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
}

test('snapshot renderer strips event handler attributes', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['IMG', { 'onerror': 'alert(1)', 'src': 'x' }]]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain('onerror="alert(1)"');
  expect(html).toContain('src="x"');
});

test('snapshot renderer strips onclick attributes', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['DIV', { 'onClick': 'alert(1)' }, 'click me']]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain('onClick');
  expect(html).not.toContain('onclick');
  expect(html).toContain('click me');
});

test('snapshot renderer neutralizes iframe srcdoc', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['IFRAME', { 'srcdoc': '<script>alert(1)</script>' }]]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain(' srcdoc=');
  expect(html).toContain('__playwright_srcdoc__');
});

test('snapshot renderer neutralizes iframe sandbox', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['IFRAME', { 'sandbox': 'allow-scripts allow-top-navigation' }]]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain(' sandbox=');
  expect(html).toContain('__playwright_sandbox__');
});

test('snapshot renderer neutralizes object data attribute', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['OBJECT', { 'data': '/sha1/malicious', 'type': 'text/html' }]]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain(' data=');
  expect(html).toContain('__playwright_data__');
});

test('snapshot renderer neutralizes embed src attribute', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['EMBED', { 'src': '/sha1/malicious', 'type': 'text/html' }]]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain(' src=');
  expect(html).toContain('__playwright_src__');
});

test('snapshot renderer handles case-insensitive iframe tag names', () => {
  const renderer = new SnapshotRenderer(new LRUCache(1_000_000), [], [makeSnapshot({
    html: ['HTML', {}, ['BODY', {}, ['iframe', { 'srcdoc': '<script>alert(1)</script>', 'src': 'http://evil.com' }]]],
  })], [], 0);
  const { html } = renderer.render();
  expect(html).not.toContain(' srcdoc=');
  expect(html).toContain('__playwright_srcdoc__');
  expect(html).toContain('__playwright_src__');
});
