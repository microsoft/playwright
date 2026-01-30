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

import { Artifact } from './artifact';

import type { Connection } from './connection';
import type { Page } from './page';
import type * as api from '../../types/types';

export class Video implements api.Video {
  private _artifact: Artifact | undefined;
  private _isRemote = false;
  private _page: Page;

  constructor(page: Page, connection: Connection, artifact: Artifact | undefined) {
    this._page = page;
    this._isRemote = connection.isRemote();
    this._artifact = artifact;
  }

  async start(options: { size?: { width: number, height: number } } = {}): Promise<void> {
    const result = await this._page._channel.videoStart(options);
    this._artifact = Artifact.from(result.artifact);
  }

  async stop(): Promise<void> {
    await this._page._channel.videoStop();
  }

  async path(): Promise<string> {
    if (this._isRemote)
      throw new Error(`Path is not available when connecting remotely. Use saveAs() to save a local copy.`);
    if (!this._artifact)
      throw new Error('Video recording has not been started.');
    return this._artifact._initializer.absolutePath;
  }

  async saveAs(path: string): Promise<void> {
    if (!this._artifact)
      throw new Error('Video recording has not been started.');
    return await this._artifact.saveAs(path);
  }

  async delete(): Promise<void> {
    if (this._artifact)
      await this._artifact.delete();
  }
}
