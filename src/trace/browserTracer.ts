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

import { BrowserBase } from '../browser';
import { TraceController } from './traceController';

let browserCounter = 0;

export type BrowserCreatedTraceEvent = {
  type: 'browser-created',
  name: string,
  browserId: string,
};

export type BrowserDestroyedTraceEvent = {
  type: 'browser-destroyed',
  browserId: string,
};

export class BrowserTracer {
  private _controller: TraceController;
  private _browser: BrowserBase;
  private _browserEventPromise: Promise<void>;
  readonly browserId: string;

  constructor(controller: TraceController, browser: BrowserBase) {
    this._controller = controller;
    this._browser = browser;
    this.browserId = 'browser' + (++browserCounter);

    const event: BrowserCreatedTraceEvent = {
      type: 'browser-created',
      browserId: this.browserId,
      name: this._browser._options.name,
    };
    this._browserEventPromise = controller.appendTraceEvent(event);
  }

  async dispose() {
    await this._browserEventPromise;
    const event: BrowserDestroyedTraceEvent = {
      type: 'browser-destroyed',
      browserId: this.browserId,
    };
    await this._controller.appendTraceEvent(event);
  }
}
