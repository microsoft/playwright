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

export class Overlay implements api.Overlay {
  private readonly _page: Page;

  constructor(page: Page) {
    this._page = page;
  }

  async show(html: string, options?: { duration?: number }): Promise<DisposableStub> {
    const { id } = await this._page._channel.overlayShow({ html, duration: options?.duration });
    return new DisposableStub(() => this._page._channel.overlayRemove({ id }));
  }

  async chapter(title: string, options?: { description?: string, duration?: number }): Promise<void> {
    await this._page._channel.overlayChapter({ title, ...options });
  }

  async setVisible(visible: boolean): Promise<void> {
    await this._page._channel.overlaySetVisible({ visible });
  }
}
