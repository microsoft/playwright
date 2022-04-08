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

import type { BrowserContext } from '../../browserContext';
import type { Page } from '../../page';
import type { FrameSnapshot } from '../common/snapshotTypes';
import type { SnapshotRenderer } from '../../../../../trace-viewer/src/snapshotRenderer';
import { BaseSnapshotStorage } from '../../../../../trace-viewer/src/snapshotStorage';
import type { SnapshotterBlob, SnapshotterDelegate } from '../recorder/snapshotter';
import { Snapshotter } from '../recorder/snapshotter';
import type { ElementHandle } from '../../dom';
import type { HarTracerDelegate } from '../../har/harTracer';
import { HarTracer } from '../../har/harTracer';
import type * as har from '../../har/har';

export class InMemorySnapshotter extends BaseSnapshotStorage implements SnapshotterDelegate, HarTracerDelegate {
  private _blobs = new Map<string, Buffer>();
  private _snapshotter: Snapshotter;
  private _harTracer: HarTracer;

  constructor(context: BrowserContext) {
    super();
    this._snapshotter = new Snapshotter(context, this);
    this._harTracer = new HarTracer(context, this, { content: 'sha1', waitForContentOnStop: false, skipScripts: true });
  }

  async initialize(): Promise<void> {
    await this._snapshotter.start();
    this._harTracer.start();
  }

  async reset() {
    await this._snapshotter.reset();
    await this._harTracer.flush();
    this._harTracer.stop();
    this._harTracer.start();
    this.clear();
  }

  async dispose() {
    this._snapshotter.dispose();
    await this._harTracer.flush();
    this._harTracer.stop();
  }

  async captureSnapshot(page: Page, snapshotName: string, element?: ElementHandle): Promise<SnapshotRenderer> {
    if (this._frameSnapshots.has(snapshotName))
      throw new Error('Duplicate snapshot name: ' + snapshotName);

    this._snapshotter.captureSnapshot(page, snapshotName, element).catch(() => {});
    return new Promise<SnapshotRenderer>(fulfill => {
      const disposable = this.onSnapshotEvent((renderer: SnapshotRenderer) => {
        if (renderer.snapshotName === snapshotName) {
          disposable.dispose();
          fulfill(renderer);
        }
      });
    });
  }

  onEntryStarted(entry: har.Entry) {
  }

  onEntryFinished(entry: har.Entry) {
    this.addResource(entry);
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    this._blobs.set(sha1, buffer);
  }

  onSnapshotterBlob(blob: SnapshotterBlob): void {
    this._blobs.set(blob.sha1, blob.buffer);
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    this.addFrameSnapshot(snapshot);
  }

  async resourceContent(sha1: string): Promise<Blob | undefined> {
    throw new Error('Not implemented');
  }

  async resourceContentForTest(sha1: string): Promise<Buffer | undefined> {
    return this._blobs.get(sha1);
  }
}
