/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import type { Page } from './page';
import type * as api from '../../types/types';
import type { Artifact } from './artifact';
import type { Connection } from './connection';
import { ManualPromise } from '../utils';

export class Video implements api.Video {
  private _artifact: Promise<Artifact | null> | null = null;
  private _artifactReadyPromise = new ManualPromise<Artifact>();
  private _isRemote = false;

  constructor(page: Page, connection: Connection) {
    this._isRemote = connection.isRemote();
    this._artifact = page._closedOrCrashedScope.safeRace(this._artifactReadyPromise);
  }

  _artifactReady(artifact: Artifact) {
    this._artifactReadyPromise.resolve(artifact);
  }

  async path(): Promise<string> {
    if (this._isRemote)
      throw new Error(`Path is not available when connecting remotely. Use saveAs() to save a local copy.`);
    const artifact = await this._artifact;
    if (!artifact)
      throw new Error('Page did not produce any video frames');
    return artifact._initializer.absolutePath;
  }

  async saveAs(path: string): Promise<void> {
    const artifact = await this._artifact;
    if (!artifact)
      throw new Error('Page did not produce any video frames');
    return await artifact.saveAs(path);
  }

  async delete(): Promise<void> {
    const artifact = await this._artifact;
    if (artifact)
      await artifact.delete();
  }
}
