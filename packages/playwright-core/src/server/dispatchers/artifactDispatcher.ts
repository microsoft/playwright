/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as channels from '@protocol/channels';
import { Dispatcher, existingDispatcher } from './dispatcher';
import type { DispatcherScope } from './dispatcher';
import { StreamDispatcher } from './streamDispatcher';
import fs from 'fs';
import { mkdirIfNeeded } from '../../utils/fileUtils';
import type { Artifact } from '../artifact';
import type { CallMetadata } from '../instrumentation';

export class ArtifactDispatcher extends Dispatcher<Artifact, channels.ArtifactChannel, DispatcherScope> implements channels.ArtifactChannel {
  _type_Artifact = true;

  static from(parentScope: DispatcherScope, artifact: Artifact): ArtifactDispatcher {
    return ArtifactDispatcher.fromNullable(parentScope, artifact)!;
  }

  static fromNullable(parentScope: DispatcherScope, artifact: Artifact): ArtifactDispatcher | undefined {
    if (!artifact)
      return undefined;
    const result = existingDispatcher<ArtifactDispatcher>(artifact);
    return result || new ArtifactDispatcher(parentScope, artifact);
  }

  private constructor(scope: DispatcherScope, artifact: Artifact) {
    super(scope, artifact, 'Artifact', {
      absolutePath: artifact.localPath(),
    });
  }

  async pathAfterFinished(): Promise<channels.ArtifactPathAfterFinishedResult> {
    const path = await this._object.localPathAfterFinished();
    return { value: path };
  }

  async saveAs(params: channels.ArtifactSaveAsParams): Promise<channels.ArtifactSaveAsResult> {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async (localPath, error) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          await mkdirIfNeeded(params.path);
          await fs.promises.copyFile(localPath, params.path);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async saveAsStream(): Promise<channels.ArtifactSaveAsStreamResult> {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async (localPath, error) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const readable = fs.createReadStream(localPath, { highWaterMark: 1024 * 1024 });
          const stream = new StreamDispatcher(this, readable);
          // Resolve with a stream, so that client starts saving the data.
          resolve({ stream });
          // Block the Artifact until the stream is consumed.
          await new Promise<void>(resolve => {
            readable.on('close', resolve);
            readable.on('end', resolve);
            readable.on('error', resolve);
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async stream(): Promise<channels.ArtifactStreamResult> {
    const fileName = await this._object.localPathAfterFinished();
    const readable = fs.createReadStream(fileName, { highWaterMark: 1024 * 1024 });
    return { stream: new StreamDispatcher(this, readable) };
  }

  async failure(): Promise<channels.ArtifactFailureResult> {
    const error = await this._object.failureError();
    return { error: error || undefined };
  }

  async cancel(): Promise<void> {
    await this._object.cancel();
  }

  async delete(_: any, metadata: CallMetadata): Promise<void> {
    metadata.potentiallyClosesScope = true;
    await this._object.delete();
    this._dispose();
  }
}
