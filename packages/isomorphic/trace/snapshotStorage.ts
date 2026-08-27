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
import { LRUCache } from '../lruCache';

import type { FrameSnapshot, ResourceSnapshot } from '@trace/snapshot';
import type { PageEntry } from './entries';


export class SnapshotStorage {
  private _snapshotsByFrameId = new Map<string, FrameSnapshot[]>();
  private _renderersBySnapshotName = new Map<string, SnapshotRenderer[]>();
  private _cache = new LRUCache<SnapshotRenderer, string>(100_000_000);  // 100MB per each trace
  private _resources: ResourceSnapshot[] = [];
  private _resourceUrlsWithOverrides = new Set<string>();

  addResource(resource: ResourceSnapshot): void {
    resource.request.url = rewriteURLForCustomProtocol(resource.request.url);
    this._resources.push(resource);
  }

  addFrameSnapshot(snapshot: FrameSnapshot, screencastFrames: PageEntry['screencastFrames']) {
    for (const override of snapshot.resourceOverrides)
      override.url = rewriteURLForCustomProtocol(override.url);
    let frameSnapshots = this._snapshotsByFrameId.get(snapshot.frameId);
    if (!frameSnapshots) {
      frameSnapshots = [];
      this._snapshotsByFrameId.set(snapshot.frameId, frameSnapshots);
    }
    frameSnapshots.push(snapshot);
    const renderer = new SnapshotRenderer(this._cache, this._resources, frameSnapshots, screencastFrames, frameSnapshots.length - 1);
    if (snapshot.snapshotName) {
      let renderers = this._renderersBySnapshotName.get(snapshot.snapshotName);
      if (!renderers) {
        renderers = [];
        this._renderersBySnapshotName.set(snapshot.snapshotName, renderers);
      }
      renderers.push(renderer);
    }
    return renderer;
  }

  snapshotByName(snapshotName: string, frameId?: string): SnapshotRenderer | undefined {
    const renderers = this._renderersBySnapshotName.get(snapshotName) || [];
    return renderers.find(r => frameId ? r.snapshot().frameId === frameId : r.snapshot().isMainFrame);
  }

  snapshotsForTest() {
    return [...this._renderersBySnapshotName.keys()];
  }

  finalize() {
    // Resources are not necessarily sorted in the trace file, so sort them now.
    this._resources.sort((a, b) => (a._monotonicTime || 0) - (b._monotonicTime || 0));
    // Resources that have overrides should not be cached, otherwise we might get stale content
    // while serving snapshots with different override values.
    for (const frameSnapshots of this._snapshotsByFrameId.values()) {
      for (const snapshot of frameSnapshots) {
        for (const override of snapshot.resourceOverrides)
          this._resourceUrlsWithOverrides.add(override.url);
      }
    }
  }

  hasResourceOverride(url: string) {
    return this._resourceUrlsWithOverrides.has(url);
  }
}
