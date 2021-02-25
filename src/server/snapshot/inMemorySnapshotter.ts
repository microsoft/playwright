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

import { BrowserContext } from '../browserContext';
import { ContextResources, FrameSnapshot } from './snapshot';
import { SnapshotRenderer } from './snapshotRenderer';
import { NetworkResponse, SnapshotStorage } from './snapshotServer';
import { Snapshotter, SnapshotterBlob, SnapshotterDelegate, SnapshotterResource } from './snapshotter';

export class InMemorySnapshotter implements SnapshotStorage, SnapshotterDelegate {
  private _blobs = new Map<string, Buffer>();
  private _resources = new Map<string, SnapshotterResource>();
  private _frameSnapshots = new Map<string, FrameSnapshot[]>();
  private _snapshots = new Map<string, SnapshotRenderer>();
  private _contextResources: ContextResources = new Map();
  private _snapshotter: Snapshotter;

  constructor(context: BrowserContext) {
    this._snapshotter = new Snapshotter(context, this);
  }

  onBlob(blob: SnapshotterBlob): void {
    this._blobs.set(blob.sha1, blob.buffer);
  }

  onResource(resource: SnapshotterResource): void {
    this._resources.set(resource.resourceId, resource);
    let resources = this._contextResources.get(resource.url);
    if (!resources) {
      resources = [];
      this._contextResources.set(resource.url, resources);
    }
    resources.push({ frameId: resource.frameId, resourceId: resource.resourceId });
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    const key = snapshot.pageId + '/' + snapshot.frameId;
    let frameSnapshots = this._frameSnapshots.get(key);
    if (!frameSnapshots) {
      frameSnapshots = [];
      this._frameSnapshots.set(key, frameSnapshots);
    }
    frameSnapshots.push(snapshot);
    this._snapshots.set(snapshot.snapshotId, new SnapshotRenderer(new Map(this._contextResources), frameSnapshots, frameSnapshots.length - 1));
  }

  resourceContent(sha1: string): Buffer | undefined {
    return this._blobs.get(sha1);
  }

  resourceById(resourceId: string): NetworkResponse | undefined {
    return this._resources.get(resourceId)!;
  }

  snapshotById(snapshotId: string): SnapshotRenderer | undefined {
    return this._snapshots.get(snapshotId);
  }
}
