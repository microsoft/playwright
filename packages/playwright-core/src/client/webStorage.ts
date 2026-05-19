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

import type { Page } from './page';
import type * as api from '../../types/types';

export class WebStorage implements api.WebStorage {
  private _page: Page;
  private _kind: 'local' | 'session';

  constructor(page: Page, kind: 'local' | 'session') {
    this._page = page;
    this._kind = kind;
  }

  async items(): Promise<Array<{ name: string, value: string }>> {
    const { items } = await this._page._channel.webStorageItems({ kind: this._kind });
    return items;
  }

  async getItem(name: string): Promise<string | null> {
    const { value } = await this._page._channel.webStorageGetItem({ kind: this._kind, name });
    return value ?? null;
  }

  async setItem(name: string, value: string): Promise<void> {
    await this._page._channel.webStorageSetItem({ kind: this._kind, name, value });
  }

  async removeItem(name: string): Promise<void> {
    await this._page._channel.webStorageRemoveItem({ kind: this._kind, name });
  }

  async clear(): Promise<void> {
    await this._page._channel.webStorageClear({ kind: this._kind });
  }
}
