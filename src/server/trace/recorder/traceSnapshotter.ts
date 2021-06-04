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
import fs from 'fs';
import path from 'path';
import { BrowserContext } from '../../browserContext';
import { Page } from '../../page';
import { FrameSnapshot, ResourceSnapshot } from '../../snapshot/snapshotTypes';
import { Snapshotter, SnapshotterBlob, SnapshotterDelegate } from '../../snapshot/snapshotter';
import { ElementHandle } from '../../dom';
import { TraceEvent } from '../common/traceEvents';

export class TraceSnapshotter extends EventEmitter implements SnapshotterDelegate {
  private _snapshotter: Snapshotter;
  private _resourcesDir: string;
  private _writeArtifactChain = Promise.resolve();
  private _appendTraceEvent: (traceEvent: TraceEvent) => void;

  constructor(context: BrowserContext, resourcesDir: string, appendTraceEvent: (traceEvent: TraceEvent, sha1?: string) => void) {
    super();
    this._resourcesDir = resourcesDir;
    this._snapshotter = new Snapshotter(context, this);
    this._appendTraceEvent = appendTraceEvent;
    this._writeArtifactChain = Promise.resolve();
  }

  started(): boolean {
    return this._snapshotter.started();
  }

  async start(): Promise<void> {
    await this._snapshotter.start();
  }

  async stop(): Promise<void> {
    await this._snapshotter.stop();
    await this._writeArtifactChain;
  }

  async dispose() {
    this._snapshotter.dispose();
    await this._writeArtifactChain;
  }

  async captureSnapshot(page: Page, snapshotName: string, element?: ElementHandle) {
    await this._snapshotter.captureSnapshot(page, snapshotName, element).catch(() => {});
  }

  onBlob(blob: SnapshotterBlob): void {
    this._writeArtifactChain = this._writeArtifactChain.then(async () => {
      await fs.promises.writeFile(path.join(this._resourcesDir, blob.sha1), blob.buffer).catch(() => {});
    });
  }

  onResourceSnapshot(snapshot: ResourceSnapshot): void {
    this._appendTraceEvent({ type: 'resource-snapshot', snapshot });
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    this._appendTraceEvent({ type: 'frame-snapshot', snapshot });
  }
}
