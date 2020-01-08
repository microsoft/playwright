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

import { BrowserContext, BrowserContextOptions } from './browserContext';
import { EventEmitter } from './platform';

export class Browser extends EventEmitter {
  newContext(options?: BrowserContextOptions): Promise<BrowserContext> { throw new Error('Not implemented'); }
  browserContexts(): BrowserContext[] { throw new Error('Not implemented'); }
  defaultContext(): BrowserContext { throw new Error('Not implemented'); }

  disconnect(): void { throw new Error('Not implemented'); }
  isConnected(): boolean { throw new Error('Not implemented'); }
  close(): Promise<void> { throw new Error('Not implemented'); }
}
