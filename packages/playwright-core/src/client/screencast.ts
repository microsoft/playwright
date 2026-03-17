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

import { DisposableStub } from './disposable';

import type * as api from '../../types/types';
import type { Page } from './page';

export class Screencast implements api.Screencast {
  private readonly _page: Page;
  private _onFrame: ((buffer: Buffer) => any) | null = null;

  constructor(page: Page) {
    this._page = page;
    this._page._channel.on('screencastFrame', ({ data }) => {
      this._onFrame?.(data);
    });
  }

  async start(onFrame: (buffer: Buffer) => any, options: { maxSize?: { width: number, height: number } } = {}): Promise<DisposableStub> {
    this._onFrame = onFrame;
    await this._page._channel.startScreencast(options);
    return new DisposableStub(() => this.stop());
  }

  async stop(): Promise<void> {
    this._onFrame = null;
    await this._page._channel.stopScreencast();
  }
}
