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

import { start } from '../../packages/playwright-core/lib/outofprocess';
import type { Playwright } from '../../packages/playwright-core/lib/client/playwright';

export type TestModeName = 'default' | 'driver' | 'service' | 'service2';

interface TestMode {
  setup(): Promise<Playwright>;
  teardown(): Promise<void>;
}

export class DriverTestMode implements TestMode {
  private _impl: { playwright: Playwright; stop: () => Promise<void>; };

  async setup() {
    this._impl = await start({
      NODE_OPTIONS: undefined,  // Hide driver process while debugging.
    });
    return this._impl.playwright;
  }

  async teardown() {
    await this._impl.stop();
  }
}

export class DefaultTestMode implements TestMode {
  async setup() {
    return require('playwright-core');
  }

  async teardown() {
  }
}
