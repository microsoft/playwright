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
import { DisposableStub } from './disposable';
import { EventEmitter } from './eventEmitter';

import type { AnnotateOptions } from './types';
import type { Connection } from './connection';
import type { Page } from './page';
import type * as api from '../../types/types';

export class Video extends EventEmitter implements api.Video {
  private _artifact: Artifact | undefined;
  private _isRemote = false;
  private _page: Page;
  private _savePath: string | undefined;

  constructor(page: Page, connection: Connection, artifact: Artifact | undefined) {
    super(page._platform);
    this._page = page;
    this._isRemote = connection.isRemote();
    this._artifact = artifact;
  }

  async start(options: { path?: string, size?: { width: number, height: number }, annotate?: AnnotateOptions } = {}) {
    const result = await this._page._channel.videoStart({ size: options.size, annotate: options.annotate });
    this._artifact = Artifact.from(result.artifact);
    this._savePath = options.path;
    return new DisposableStub(() => this.stop());
  }

  async stop(): Promise<void> {
    await this._page._wrapApiCall(async () => {
      await this._page._channel.videoStop();
      if (this._savePath)
        await this.saveAs(this._savePath);
    });
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
