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

import { EventEmitter } from 'events';
import type { Page } from './page';

export class Frame extends EventEmitter {

  static Events = {
    InternalNavigation: 'internalnavigation',
  };

  readonly _page: Page;
  readonly _frameId: number;
  _parentFrame: Frame | null = null;
  _url?: string;

  constructor(page: Page, frameId: number, url?: string) {
    super();
    this._page = page;
    this._frameId = frameId;
    this._url = url;
  }

  _reset() {
    this._url = undefined;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  url() {
    return this._url!;
  }

  name() {
    // TODO
    return '';
  }

  async evaluateExpression(func: (...args: any[]) => any, ...args: any[]) {
    const target = { tabId: this._page._tabId, frameIds: [this._frameId] };
    const [{ result }] = await chrome.scripting.executeScript({ target, func, args });
    return result;
  }
}
