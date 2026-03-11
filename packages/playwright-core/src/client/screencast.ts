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

import { EventEmitter } from './eventEmitter';

import type * as api from '../../types/types';
import type { Page } from './page';

export class Screencast extends EventEmitter implements api.Screencast {
  private readonly _page: Page;

  constructor(page: Page) {
    super(page._platform);
    this._page = page;
    this._page._channel.on('screencastFrame', ({ data }) => this.emit('screencastframe', { data }));
  }

  async start(options: { maxSize?: { width: number, height: number } } = {}): Promise<void> {
    await this._page._channel.startScreencast(options);
  }

  async stop(): Promise<void> {
    await this._page._channel.stopScreencast();
  }
}
