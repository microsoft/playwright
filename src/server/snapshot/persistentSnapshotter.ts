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
import util from 'util';
import { BrowserContext } from '../browserContext';
import { Page } from '../page';
import { FrameSnapshot, ResourceSnapshot } from './snapshotTypes';
import { Snapshotter, SnapshotterBlob, SnapshotterDelegate } from './snapshotter';
import { ElementHandle } from '../dom';


const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const fsMkdirAsync = util.promisify(fs.mkdir.bind(fs));

const kSnapshotInterval = 100;

export class PersistentSnapshotter extends EventEmitter implements SnapshotterDelegate {
  private _snapshotter: Snapshotter;
  private _resourcesDir: string;
  private _writeArtifactChain = Promise.resolve();
  private _networkTrace: string;
  private _snapshotTrace: string;

  constructor(context: BrowserContext, tracePrefix: string, resourcesDir: string) {
    super();
    this._resourcesDir = resourcesDir;
    this._networkTrace = tracePrefix + '-network.trace';
    this._snapshotTrace = tracePrefix + '-dom.trace';
    this._snapshotter = new Snapshotter(context, this);
  }

  async start(): Promise<void> {
    await fsMkdirAsync(this._resourcesDir, {recursive: true}).catch(() => {});
    await fsAppendFileAsync(this._networkTrace, Buffer.from([]));
    await fsAppendFileAsync(this._snapshotTrace, Buffer.from([]));
    await this._snapshotter.initialize();
    await this._snapshotter.setAutoSnapshotInterval(kSnapshotInterval);
  }

  async dispose() {
    this._snapshotter.dispose();
    await this._writeArtifactChain;
  }

  captureSnapshot(page: Page, snapshotName: string, element?: ElementHandle) {
    this._snapshotter.captureSnapshot(page, snapshotName, element);
  }

  onBlob(blob: SnapshotterBlob): void {
    this._writeArtifactChain = this._writeArtifactChain.then(async () => {
      await fsWriteFileAsync(path.join(this._resourcesDir, blob.sha1), blob.buffer).catch(() => {});
    });
  }

  onResourceSnapshot(resource: ResourceSnapshot): void {
    this._writeArtifactChain = this._writeArtifactChain.then(async () => {
      await fsAppendFileAsync(this._networkTrace, JSON.stringify(resource) + '\n');
    });
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    this._writeArtifactChain = this._writeArtifactChain.then(async () => {
      await fsAppendFileAsync(this._snapshotTrace, JSON.stringify(snapshot) + '\n');
    });
  }
}
