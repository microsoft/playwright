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

import { EventEmitter } from 'events';
import { ContextResources, FrameSnapshot, ResourceSnapshot } from './snapshotTypes';
import { SnapshotRenderer } from './snapshotRenderer';

export interface SnapshotStorage {
  resources(): ResourceSnapshot[];
  resourceContent(sha1: string): Buffer | undefined;
  resourceById(resourceId: string): ResourceSnapshot | undefined;
  snapshotByName(pageOrFrameId: string, snapshotName: string): SnapshotRenderer | undefined;
}

export abstract class BaseSnapshotStorage extends EventEmitter implements SnapshotStorage {
  protected _resources: ResourceSnapshot[] = [];
  protected _resourceMap = new Map<string, ResourceSnapshot>();
  protected _frameSnapshots = new Map<string, {
    raw: FrameSnapshot[],
    renderer: SnapshotRenderer[]
  }>();
  protected _contextResources: ContextResources = new Map();
  private _contextResourcesCopyOnWrite: ContextResources | null = null;

  clear() {
    this._resources = [];
    this._resourceMap.clear();
    this._frameSnapshots.clear();
    this._contextResources.clear();
  }

  addResource(resource: ResourceSnapshot): void {
    this._contextResourcesCopyOnWrite = null;
    this._resourceMap.set(resource.resourceId, resource);
    this._resources.push(resource);
    let resources = this._contextResources.get(resource.url);
    if (!resources) {
      resources = [];
      this._contextResources.set(resource.url, resources);
    }
    resources.push({ frameId: resource.frameId, resourceId: resource.resourceId });
  }

  addFrameSnapshot(snapshot: FrameSnapshot): void {
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
    if (!this._contextResourcesCopyOnWrite)
      this._contextResourcesCopyOnWrite = new Map(this._contextResources);
    const renderer = new SnapshotRenderer(this._contextResourcesCopyOnWrite, frameSnapshots.raw, frameSnapshots.raw.length - 1);
    frameSnapshots.renderer.push(renderer);
    this.emit('snapshot', renderer);
  }

  abstract resourceContent(sha1: string): Buffer | undefined;

  resourceById(resourceId: string): ResourceSnapshot | undefined {
    return this._resourceMap.get(resourceId)!;
  }

  resources(): ResourceSnapshot[] {
    return this._resources.slice();
  }

  snapshotByName(pageOrFrameId: string, snapshotName: string): SnapshotRenderer | undefined {
    const snapshot = this._frameSnapshots.get(pageOrFrameId);
    return snapshot?.renderer.find(r => r.snapshotName === snapshotName);
  }
}
