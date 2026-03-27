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

import type { AnnotateOptions } from './types';
import type * as api from '../../types/types';
import type { Page } from './page';

export class Screencast implements api.Screencast {
  private readonly _page: Page;
  private _onFrame: ((frame: { data: Buffer }) => Promise<any>) | null = null;
  private _artifact: Artifact | undefined;
  private _savePath: string | undefined;

  constructor(page: Page) {
    this._page = page;
    this._page._channel.on('screencastFrame', ({ data }) => {
      void this._onFrame?.({ data });
    });
  }

  async start(options: { onFrame?: (frame: { data: Buffer }) => Promise<any>|any, path?: string, size?: { width: number, height: number }, annotate?: AnnotateOptions } = {}): Promise<DisposableStub> {
    this._onFrame = options.onFrame ?? null;
    this._savePath = options.path;
    const result = await this._page._channel.startScreencast({ saveFile: !!options.path, sendFrames: !!options.onFrame, size: options.size, annotate: options.annotate });
    if (result.artifact)
      this._artifact = Artifact.from(result.artifact);
    return new DisposableStub(() => this.stop());
  }

  async stop(): Promise<void> {
    await this._page._wrapApiCall(async () => {
      this._onFrame = null;
      await this._page._channel.stopScreencast();
      if (this._savePath && this._artifact)
        await this._artifact.saveAs(this._savePath);
      this._artifact = undefined;
      this._savePath = undefined;
    });
  }
}
