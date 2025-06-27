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

import fs from 'fs';

import { Dispatcher } from './dispatcher';
import { StreamDispatcher } from './streamDispatcher';
import { mkdirIfNeeded } from '../utils/fileUtils';

import type { DispatcherScope } from './dispatcher';
import type { Artifact } from '../artifact';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class ArtifactDispatcher extends Dispatcher<Artifact, channels.ArtifactChannel, DispatcherScope> implements channels.ArtifactChannel {
  _type_Artifact = true;

  static from(parentScope: DispatcherScope, artifact: Artifact): ArtifactDispatcher {
    return ArtifactDispatcher.fromNullable(parentScope, artifact)!;
  }

  static fromNullable(parentScope: DispatcherScope, artifact: Artifact): ArtifactDispatcher | undefined {
    if (!artifact)
      return undefined;
    const result = parentScope.connection.existingDispatcher<ArtifactDispatcher>(artifact);
    return result || new ArtifactDispatcher(parentScope, artifact);
  }

  private constructor(scope: DispatcherScope, artifact: Artifact) {
    super(scope, artifact, 'Artifact', {
      absolutePath: artifact.localPath(),
    });
  }

  async pathAfterFinished(params: channels.ArtifactPathAfterFinishedParams, progress: Progress): Promise<channels.ArtifactPathAfterFinishedResult> {
    const path = await progress.race(this._object.localPathAfterFinished());
    return { value: path };
  }

  async saveAs(params: channels.ArtifactSaveAsParams, progress: Progress): Promise<channels.ArtifactSaveAsResult> {
    return await progress.race(new Promise((resolve, reject) => {
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
    }));
  }

  async saveAsStream(params: channels.ArtifactSaveAsStreamParams, progress: Progress): Promise<channels.ArtifactSaveAsStreamResult> {
    return await progress.race(new Promise((resolve, reject) => {
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
    }));
  }

  async stream(params: channels.ArtifactStreamParams, progress: Progress): Promise<channels.ArtifactStreamResult> {
    const fileName = await progress.race(this._object.localPathAfterFinished());
    const readable = fs.createReadStream(fileName, { highWaterMark: 1024 * 1024 });
    return { stream: new StreamDispatcher(this, readable) };
  }

  async failure(params: channels.ArtifactFailureParams, progress: Progress): Promise<channels.ArtifactFailureResult> {
    const error = await progress.race(this._object.failureError());
    return { error: error || undefined };
  }

  async cancel(params: channels.ArtifactCancelParams, progress: Progress): Promise<void> {
    await progress.race(this._object.cancel());
  }

  async delete(params: channels.ArtifactDeleteParams, progress: Progress): Promise<void> {
    progress.metadata.potentiallyClosesScope = true;
    await progress.race(this._object.delete());
    this._dispose();
  }
}
