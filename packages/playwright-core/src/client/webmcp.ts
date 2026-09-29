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
import { EventEmitter } from './eventEmitter';
import { Events } from './events';
import { kNoTimeout } from './timeoutSettings';
import { Waiter } from './waiter';

import type { Frame } from './frame';
import type * as api from '../../types/types';
import type * as channels from './channels';
import type { WaitForEventOptions } from './types';

export type WebMCPTool = channels.FrameWebmcpToolsResult['tools'][number];

export class WebMCP extends EventEmitter implements api.WebMCP {
  private _frame: Frame;

  constructor(frame: Frame) {
    super();
    this.setMaxListeners(0);
    this._frame = frame;
    this._frame._channel.on('webmcpToolsChanged', ({ tools }) => this.emit(Events.WebMCP.ToolsChanged, tools));
  }

  async enable(): Promise<DisposableStub> {
    await this._frame._channel.webmcpEnable({}, kNoTimeout);
    return new DisposableStub(() => this.disable());
  }

  async disable(): Promise<void> {
    await this._frame._channel.webmcpDisable({}, kNoTimeout);
  }

  async tools(options: { timeout?: number } = {}): Promise<WebMCPTool[]> {
    const { tools } = await this._frame._channel.webmcpTools({}, this._frame._timeout(options));
    return tools;
  }

  async callTool(name: string, input?: any, options: { timeout?: number } = {}): Promise<any> {
    const { result } = await this._frame._channel.webmcpCallTool({ name, input }, this._frame._timeout(options));
    return result;
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return await this._frame._wrapApiCall(async () => {
      const timeoutOptions = this._frame._timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this._frame, event);
      waiter.rejectOnTimeout(timeoutOptions, `Timeout ${timeoutOptions.timeout}ms exceeded while waiting for event "${event}"`);
      const page = this._frame._page;
      if (page)
        waiter.rejectOnEvent(page, Events.Page.Close, () => page._closeErrorWithReason());
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }
}
