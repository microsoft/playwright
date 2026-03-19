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
  private _listeners = new Set<(frame: { data: Buffer }) => any>();

  constructor(page: Page) {
    this._page = page;
    this._page._channel.on('screencastFrame', ({ data }) => {
      for (const listener of this._listeners)
        void listener({ data });
    });
  }

  async start(onFrame: (frame: { data: Buffer }) => Promise<any>|any, options: { preferredSize?: { width: number, height: number } } = {}): Promise<DisposableStub> {
    this._listeners.add(onFrame);
    if (this._listeners.size === 1)
      await this._page._channel.startScreencast(options);
    return new DisposableStub(async () => {
      this._listeners.delete(onFrame);
      if (!this._listeners.size)
        await this._page._channel.stopScreencast();
    });
  }
}
