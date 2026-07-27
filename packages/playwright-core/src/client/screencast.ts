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
import { isTargetClosedError } from './errors';
import { kNoTimeout } from './timeoutSettings';

import type * as api from '../../types/types';
import type { Page } from './page';

export class Screencast implements api.Screencast {
  private _page: Page;
  private _started = false;
  private _savePath: string | undefined;
  private _onFrame: ((frame: { data: Buffer, timestamp: number, viewportWidth: number, viewportHeight: number }) => Promise<any>) | null = null;
  private _artifact: Artifact | undefined;

  constructor(page: Page) {
    this._page = page;
    this._page._channel.on('screencastFrame', async ({ frameId, data, timestamp, viewportWidth, viewportHeight }) => {
      try {
        await this._onFrame?.({ data, timestamp, viewportWidth, viewportHeight });
      } finally {
        await this._page._channel.screencastFrameAck({ frameId }, kNoTimeout).catch(() => {});
      }
    });
  }

  async start(options: { onFrame?: (frame: { data: Buffer, timestamp: number, viewportWidth: number, viewportHeight: number }) => Promise<any>|any, path?: string, size?: { width: number, height: number }, quality?: number } = {}): Promise<DisposableStub> {
    if (this._started)
      throw new Error('Screencast is already started');
    this._started = true;
    if (options.onFrame)
      this._onFrame = options.onFrame;
    const result = await this._page._channel.screencastStart({
      size: options.size,
      quality: options.quality,
      sendFrames: !!options.onFrame,
      record: !!options.path,
    }, kNoTimeout);
    if (result.artifact) {
      this._artifact = Artifact.from(result.artifact);
      this._savePath = options.path;
    }
    return new DisposableStub(() => this.stop());
  }

  async stop(options: { discard?: boolean } = {}): Promise<void> {
    await this._page._wrapApiCall(async () => {
      this._started = false;
      this._onFrame = null;
      const artifact = this._artifact;
      const savePath = this._savePath;
      this._artifact = undefined;
      this._savePath = undefined;
      try {
        await this._page._channel.screencastStop({}, kNoTimeout);
      } catch (e) {
        // Closing the page stops the screencast server-side, and the video can still be saved.
        if (!isTargetClosedError(e))
          throw e;
      }
      if (!artifact || !savePath)
        return;
      if (options.discard)
        await artifact.delete();
      else
        await artifact.saveAs(savePath, { dispose: true });
    });
  }

  async showActions(options?: { duration?: number, position?: 'top-left' | 'top' | 'top-right' | 'bottom-left' | 'bottom' | 'bottom-right', fontSize?: number, cursor?: 'none' | 'pointer' }): Promise<DisposableStub> {
    await this._page._channel.screencastShowActions({ duration: options?.duration, position: options?.position, fontSize: options?.fontSize, cursor: options?.cursor }, kNoTimeout);
    return new DisposableStub(() => this._page._channel.screencastHideActions({}, kNoTimeout));
  }

  async hideActions(): Promise<void> {
    await this._page._channel.screencastHideActions({}, kNoTimeout);
  }

  async showOverlay(html: string, options?: { duration?: number }): Promise<DisposableStub> {
    const { id } = await this._page._channel.screencastShowOverlay({ html, duration: options?.duration }, kNoTimeout);
    return new DisposableStub(() => this._page._channel.screencastRemoveOverlay({ id }, kNoTimeout));
  }

  async showChapter(title: string, options?: { description?: string, duration?: number }): Promise<void> {
    await this._page._channel.screencastChapter({ title, ...options }, kNoTimeout);
  }

  async showOverlays(): Promise<void> {
    await this._page._channel.screencastSetOverlayVisible({ visible: true }, kNoTimeout);
  }

  async hideOverlays(): Promise<void> {
    await this._page._channel.screencastSetOverlayVisible({ visible: false }, kNoTimeout);
  }
}
