/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { kNoTimeout } from './timeoutSettings';

import type { BrowserContext } from './browserContext';
import type * as api from '../../types/types';

export class Clipboard implements api.Clipboard {
  private _browserContext: BrowserContext;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async install(): Promise<void> {
    await this._browserContext._channel.clipboardInstall({}, kNoTimeout);
  }

  async readText(): Promise<string> {
    const { text } = await this._browserContext._channel.clipboardReadText({}, kNoTimeout);
    return text;
  }

  async writeText(text: string): Promise<void> {
    await this._browserContext._channel.clipboardWriteText({ text }, kNoTimeout);
  }

  async read(): Promise<{ mimeType: string, buffer: Buffer }[]> {
    const { items } = await this._browserContext._channel.clipboardRead({}, kNoTimeout);
    return items;
  }

  async write(items: { mimeType: string, buffer: Buffer }[]): Promise<void> {
    await this._browserContext._channel.clipboardWrite({ items }, kNoTimeout);
  }
}
