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

import { Page, BrowserContext, BrowserContextOptions } from './types/types';
import * as apiInternal from './android-types-internal';
import { EventEmitter } from 'events';

export { AndroidElementInfo, AndroidSelector } from './android-types-internal';
export type AndroidDevice  = apiInternal.AndroidDevice<BrowserContextOptions, BrowserContext, Page>;
export type AndroidWebView  = apiInternal.AndroidWebView<Page>;

export interface Android extends EventEmitter {
  setDefaultTimeout(timeout: number): void;
  devices(): Promise<AndroidDevice[]>;
}
