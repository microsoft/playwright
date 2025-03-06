/**
 * Copyright (c) Microsoft Corporation.
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

import { rewriteURLForCustomProtocol, SnapshotRenderer } from './snapshotRenderer';
import { LRUCache } from './lruCache';

import type { FrameSnapshot, ResourceSnapshot } from '@trace/snapshot';
import type { PageEntry } from '../types/entries';


export class SnapshotStorage {
  private _frameSnapshots = new Map<string, {
    raw: FrameSnapshot[],
    renderers: SnapshotRenderer[],
  }>();
  private _cache = new LRUCache<SnapshotRenderer, string>(100_000_000);  // 100MB per each trace
  private _contextToResources = new Map<string, ResourceSnapshot[]>();

  addResource(contextId: string, resource: ResourceSnapshot): void {
    resource.request.url = rewriteURLForCustomProtocol(resource.request.url);
    this._ensureResourcesForContext(contextId).push(resource);
  }

  addFrameSnapshot(contextId: string, snapshot: FrameSnapshot, screencastFrames: PageEntry['screencastFrames']) {
    for (const override of snapshot.resourceOverrides)
      override.url = rewriteURLForCustomProtocol(override.url);
    let frameSnapshots = this._frameSnapshots.get(snapshot.frameId);
    if (!frameSnapshots) {
      frameSnapshots = {
        raw: [],
        renderers: [],
      };
      this._frameSnapshots.set(snapshot.frameId, frameSnapshots);
      if (snapshot.isMainFrame)
        this._frameSnapshots.set(snapshot.pageId, frameSnapshots);
    }
    frameSnapshots.raw.push(snapshot);
    const resources = this._ensureResourcesForContext(contextId);
    const renderer = new SnapshotRenderer(this._cache, resources, frameSnapshots.raw, screencastFrames, frameSnapshots.raw.length - 1);
    frameSnapshots.renderers.push(renderer);
    return renderer;
  }

  snapshotByName(pageOrFrameId: string, snapshotName: string): SnapshotRenderer | undefined {
    const snapshot = this._frameSnapshots.get(pageOrFrameId);
    return snapshot?.renderers.find(r => r.snapshotName === snapshotName);
  }

  snapshotsForTest() {
    return [...this._frameSnapshots.keys()];
  }

  finalize() {
    // Resources are not necessarily sorted in the trace file, so sort them now.
    for (const resources of this._contextToResources.values())
      resources.sort((a, b) => (a._monotonicTime || 0) - (b._monotonicTime || 0));
  }

  private _ensureResourcesForContext(contextId: string): ResourceSnapshot[] {
    let resources = this._contextToResources.get(contextId);
    if (!resources) {
      resources = [];
      this._contextToResources.set(contextId, resources);
    }
    return resources;
  }
}
