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
