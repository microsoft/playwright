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

import type { FrameSnapshot, ResourceSnapshot } from '@trace/snapshot';
import { EventEmitter } from './events';
import { rewriteURLForCustomProtocol, SnapshotRenderer } from './snapshotRenderer';

export interface SnapshotStorage {
  resources(): ResourceSnapshot[];
  resourceContent(sha1: string): Promise<Blob | undefined>;
  snapshotByName(pageOrFrameId: string, snapshotName: string): SnapshotRenderer | undefined;
  snapshotByIndex(frameId: string, index: number): SnapshotRenderer | undefined;
}

export abstract class BaseSnapshotStorage  implements SnapshotStorage {
  protected _resources: ResourceSnapshot[] = [];
  protected _frameSnapshots = new Map<string, {
    raw: FrameSnapshot[],
    renderer: SnapshotRenderer[]
  }>();
  private _didSnapshot = new EventEmitter<SnapshotRenderer>();
  readonly onSnapshotEvent = this._didSnapshot.event;

  clear() {
    this._resources = [];
    this._frameSnapshots.clear();
  }

  addResource(resource: ResourceSnapshot): void {
    resource.request.url = rewriteURLForCustomProtocol(resource.request.url);
    this._resources.push(resource);
  }

  addFrameSnapshot(snapshot: FrameSnapshot): void {
    for (const override of snapshot.resourceOverrides)
      override.url = rewriteURLForCustomProtocol(override.url);
    let frameSnapshots = this._frameSnapshots.get(snapshot.frameId);
    if (!frameSnapshots) {
      frameSnapshots = {
        raw: [],
        renderer: [],
      };
      this._frameSnapshots.set(snapshot.frameId, frameSnapshots);
      if (snapshot.isMainFrame)
        this._frameSnapshots.set(snapshot.pageId, frameSnapshots);
    }
    frameSnapshots.raw.push(snapshot);
    const renderer = new SnapshotRenderer(this._resources, frameSnapshots.raw, frameSnapshots.raw.length - 1);
    frameSnapshots.renderer.push(renderer);
    this._didSnapshot.fire(renderer);
  }

  abstract resourceContent(sha1: string): Promise<Blob | undefined>;

  resources(): ResourceSnapshot[] {
    return this._resources.slice();
  }

  snapshotByName(pageOrFrameId: string, snapshotName: string): SnapshotRenderer | undefined {
    const snapshot = this._frameSnapshots.get(pageOrFrameId);
    return snapshot?.renderer.find(r => r.snapshotName === snapshotName);
  }

  snapshotByIndex(frameId: string, index: number): SnapshotRenderer | undefined {
    const snapshot = this._frameSnapshots.get(frameId);
    return snapshot?.renderer[index];
  }
}
