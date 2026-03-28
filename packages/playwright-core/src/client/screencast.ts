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

import type * as api from '../../types/types';
import type { Page } from './page';
import type { AnnotateOptions } from './types';

export class Screencast implements api.Screencast {
  private _page: Page;
  private _savePath: string | undefined;
  private _onFrame: ((frame: { data: Buffer }) => Promise<any>) | null = null;
  private _artifact: Artifact | undefined;

  constructor(page: Page) {
    this._page = page;
    this._page._channel.on('screencastFrame', ({ data }) => {
      void this._onFrame?.({ data });
    });
  }

  async start(onFrame: (frame: { data: Buffer }) => Promise<any>|any, options: { size?: { width: number, height: number }, quality?: number } = {}): Promise<DisposableStub> {
    if (this._onFrame)
      throw new Error('Screencast is already started');
    this._onFrame = onFrame;
    await this._page._channel.startScreencast(options);
    return new DisposableStub(() => this.stop());
  }

  async stop(): Promise<void> {
    this._onFrame = null;
    await this._page._channel.stopScreencast();
  }

  async startRecording(path: string, options: { size?: { width: number, height: number }, annotate?: AnnotateOptions } = {}) {
    const result = await this._page._channel.videoStart({ size: options.size, annotate: options.annotate });
    this._artifact = Artifact.from(result.artifact);
    this._savePath = path;
    return new DisposableStub(() => this.stopRecording());
  }

  async stopRecording(): Promise<void> {
    await this._page._wrapApiCall(async () => {
      await this._page._channel.videoStop();
      if (this._savePath)
        await this._artifact?.saveAs(this._savePath);
    });
  }

  async showOverlay(html: string, options?: { duration?: number }): Promise<DisposableStub> {
    const { id } = await this._page._channel.overlayShow({ html, duration: options?.duration });
    return new DisposableStub(() => this._page._channel.overlayRemove({ id }));
  }

  async showChapter(title: string, options?: { description?: string, duration?: number }): Promise<void> {
    await this._page._channel.overlayChapter({ title, ...options });
  }

  async showOverlays(): Promise<void> {
    await this._page._channel.overlaySetVisible({ visible: true });
  }

  async hideOverlays(): Promise<void> {
    await this._page._channel.overlaySetVisible({ visible: false });
  }
}
