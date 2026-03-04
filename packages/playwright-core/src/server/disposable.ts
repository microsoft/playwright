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

import { SdkObject } from './instrumentation';

import type { Page } from './page';
import type { BrowserContext } from './browserContext';

export abstract class Disposable extends SdkObject {
  readonly parent: Page | BrowserContext;

  constructor(parent: Page | BrowserContext) {
    super(parent, 'disposable');
    this.parent = parent;
  }

  abstract dispose(): Promise<void>;
}
