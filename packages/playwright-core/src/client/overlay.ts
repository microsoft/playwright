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

  async add(html: string, options?: { timeout?: number }): Promise<DisposableStub> {
    const { id } = await this._page._channel.overlayAdd({ html, timeout: options?.timeout });
    return new DisposableStub(() => this._page._channel.overlayRemove({ id }));
  }

  async hide(): Promise<void> {
    await this._page._channel.overlayHide();
  }

  async show(): Promise<void> {
    await this._page._channel.overlayShow();
  }

  async configure(options: { actionDelay?: number; actionStyle?: string; locatorStyle?: string } = {}): Promise<void> {
    await this._page._channel.overlayConfigure(options);
  }
}
