/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { EventEmitter } from 'events';
import type { Browser } from './browser';
import type { BrowserContext } from './browserContext';
import type { BrowserType } from './browserType';
import type { Frame } from './frames';
import type { Page } from './page';

export type Attribution = {
  browserType?: BrowserType;
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  frame?: Frame;
};

export class SdkObject extends EventEmitter {
  attribution: Attribution;
  constructor(parent: SdkObject | null) {
    super();
    this.setMaxListeners(0);
    this.attribution = { ...parent?.attribution };
  }
}
