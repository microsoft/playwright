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

import { ManualPromise } from '../utils/isomorphic/manualPromise';
import { Artifact } from './artifact';

import type { Connection } from './connection';
import type { Page } from './page';
import type * as api from '../../types/types';

export class Video implements api.Video {
  private _artifact: Promise<Artifact | null> | null = null;
  private _artifactReadyPromise: ManualPromise<Artifact>;
  private _isRemote = false;
  private _page: Page;
  private _path: string | undefined;

  constructor(page: Page, connection: Connection) {
    this._page = page;
    this._isRemote = connection.isRemote();
    this._artifactReadyPromise = new ManualPromise<Artifact>();
    this._artifact = page._closedOrCrashedScope.safeRace(this._artifactReadyPromise);
  }

  _artifactReady(artifact: Artifact) {
    this._artifactReadyPromise.resolve(artifact);
  }

  async start(options: { size?: { width: number, height: number } } = {}): Promise<void> {
    const result = await this._page._channel.videoStart(options);
    this._path = result.path;
    this._artifactReadyPromise = new ManualPromise<Artifact>();
    this._artifact = this._page._closedOrCrashedScope.safeRace(this._artifactReadyPromise);
  }

  async stop(options: { path?: string } = {}): Promise<void> {
    await this._page._wrapApiCall(async () => {
      await this._page._channel.videoStop();
      if (options.path)
        await this.saveAs(options.path);
    });
  }

  async path(): Promise<string> {
    if (this._isRemote)
      throw new Error(`Path is not available when connecting remotely. Use saveAs() to save a local copy.`);
    if (this._path)
      return this._path;

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
