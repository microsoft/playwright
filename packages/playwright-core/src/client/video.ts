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
import { EventEmitter } from './eventEmitter';

import type { Connection } from './connection';
import type { Page } from './page';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';

export class Video extends EventEmitter implements api.Video {
  private _artifact: Artifact | undefined;
  private _isRemote = false;
  private _page: Page;
  private _stopFrameEvents: (() => void) | null = null;

  constructor(page: Page, connection: Connection, artifact: Artifact | undefined) {
    super(page._platform);
    this._page = page;
    this._isRemote = connection.isRemote();
    this._artifact = artifact;
  }

  async start(options: { size?: { width: number, height: number }, mode?: 'video' | 'screencast' } = {}): Promise<void> {
    const result = await this._page._channel.videoStart(options);
    if (result.artifact)
      this._artifact = Artifact.from(result.artifact);
    if (options.mode === 'screencast') {
      const listener = ({ data }: channels.PageVideoFrameEvent) => {
        this.emit('frame', data);
      };
      this._page._channel.on('videoFrame', listener);
      this._stopFrameEvents = () => (this._page._channel as unknown as EventEmitter).removeListener('videoFrame', listener);
    }
  }

  async stop(options: { path?: string } = {}): Promise<void> {
    await this._page._wrapApiCall(async () => {
      await this._page._channel.videoStop();
      if (this._stopFrameEvents) {
        this._stopFrameEvents();
        this._stopFrameEvents = null;
      }
      if (options.path)
        await this.saveAs(options.path);
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
