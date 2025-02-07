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

import { SnapshotStorage } from '../../../../../trace-viewer/src/sw/snapshotStorage';
import { ManualPromise } from '../../../utils';
import { HarTracer } from '../../har/harTracer';
import { Snapshotter } from '../recorder/snapshotter';

import type { SnapshotRenderer } from '../../../../../trace-viewer/src/sw/snapshotRenderer';
import type { BrowserContext } from '../../browserContext';
import type { HarTracerDelegate } from '../../har/harTracer';
import type { Page } from '../../page';
import type { SnapshotterBlob, SnapshotterDelegate } from '../recorder/snapshotter';
import type * as har from '@trace/har';
import type { FrameSnapshot } from '@trace/snapshot';


export class InMemorySnapshotter implements SnapshotterDelegate, HarTracerDelegate {
  private _blobs = new Map<string, Buffer>();
  private _snapshotter: Snapshotter;
  private _harTracer: HarTracer;
  private _snapshotReadyPromises = new Map<string, ManualPromise<SnapshotRenderer>>();
  private _storage: SnapshotStorage;
  private _snapshotCount = 0;

  constructor(context: BrowserContext) {
    this._snapshotter = new Snapshotter(context, this);
    this._harTracer = new HarTracer(context, null, this, { content: 'attach', includeTraceInfo: true, recordRequestOverrides: false, waitForContentOnStop: false });
    this._storage = new SnapshotStorage();
  }

  async initialize(): Promise<void> {
    await this._snapshotter.start();
    this._harTracer.start({ omitScripts: true });
  }

  async reset() {
    await this._snapshotter.reset();
    await this._harTracer.flush();
    this._harTracer.stop();
    this._harTracer.start({ omitScripts: true });
  }

  async dispose() {
    this._snapshotter.dispose();
    await this._harTracer.flush();
    this._harTracer.stop();
  }

  async captureSnapshot(page: Page, callId: string, snapshotName: string): Promise<SnapshotRenderer> {
    if (this._snapshotReadyPromises.has(snapshotName))
      throw new Error('Duplicate snapshot name: ' + snapshotName);

    this._snapshotter.captureSnapshot(page, callId, snapshotName).catch(() => {});
    const promise = new ManualPromise<SnapshotRenderer>();
    this._snapshotReadyPromises.set(snapshotName, promise);
    return promise;
  }

  onEntryStarted(entry: har.Entry) {
  }

  onEntryFinished(entry: har.Entry) {
    this._storage.addResource('', entry);
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    this._blobs.set(sha1, buffer);
  }

  onSnapshotterBlob(blob: SnapshotterBlob): void {
    this._blobs.set(blob.sha1, blob.buffer);
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    ++this._snapshotCount;
    const renderer = this._storage.addFrameSnapshot('', snapshot, []);
    this._snapshotReadyPromises.get(snapshot.snapshotName || '')?.resolve(renderer);
  }

  async resourceContentForTest(sha1: string): Promise<Buffer | undefined> {
    return this._blobs.get(sha1);
  }

  snapshotCount() {
    return this._snapshotCount;
  }
}
