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
import { HttpServer } from '../../utils/httpServer';
import { BrowserContext } from '../browserContext';
import { helper } from '../helper';
import { Page } from '../page';
import { ContextResources, FrameSnapshot } from './snapshot';
import { SnapshotRenderer } from './snapshotRenderer';
import { NetworkResponse, SnapshotServer, SnapshotStorage } from './snapshotServer';
import { Snapshotter, SnapshotterBlob, SnapshotterDelegate, SnapshotterResource } from './snapshotter';

const kSnapshotInterval = 25;

export class InMemorySnapshotter extends EventEmitter implements SnapshotStorage, SnapshotterDelegate {
  private _blobs = new Map<string, Buffer>();
  private _resources = new Map<string, SnapshotterResource>();
  private _frameSnapshots = new Map<string, FrameSnapshot[]>();
  private _snapshots = new Map<string, SnapshotRenderer>();
  private _contextResources: ContextResources = new Map();
  private _server: HttpServer;
  private _snapshotter: Snapshotter;

  constructor(context: BrowserContext) {
    super();
    this._server = new HttpServer();
    new SnapshotServer(this._server, this);
    this._snapshotter = new Snapshotter(context, this);
  }

  async initialize(): Promise<string> {
    await this._snapshotter.initialize();
    return await this._server.start();
  }

  async start(): Promise<void> {
    await this._snapshotter.setAutoSnapshotInterval(kSnapshotInterval);
  }

  async dispose() {
    this._snapshotter.dispose();
    await this._server.stop();
  }

  async captureSnapshot(page: Page, snapshotId: string): Promise<SnapshotRenderer> {
    if (this._snapshots.has(snapshotId))
      throw new Error('Duplicate snapshotId: ' + snapshotId);

    this._snapshotter.captureSnapshot(page, snapshotId);
    return new Promise<SnapshotRenderer>(fulfill => {
      const listener = helper.addEventListener(this, 'snapshot', (renderer: SnapshotRenderer) => {
        if (renderer.snapshotId === snapshotId) {
          helper.removeEventListeners([listener]);
          fulfill(renderer);
        }
      });
    });
  }

  async setAutoSnapshotInterval(interval: number): Promise<void> {
    await this._snapshotter.setAutoSnapshotInterval(interval);
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
    let frameSnapshots = this._frameSnapshots.get(snapshot.frameId);
    if (!frameSnapshots) {
      frameSnapshots = [];
      this._frameSnapshots.set(snapshot.frameId, frameSnapshots);
    }
    frameSnapshots.push(snapshot);
    const renderer = new SnapshotRenderer(new Map(this._contextResources), frameSnapshots, frameSnapshots.length - 1);
    this._snapshots.set(snapshot.snapshotId, renderer);
    this.emit('snapshot', renderer);
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

  frameSnapshots(frameId: string): FrameSnapshot[] {
    return this._frameSnapshots.get(frameId) || [];
  }
}
