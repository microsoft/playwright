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
import { Frame } from './frame';
import { kNoTimeout } from './timeoutSettings';
import { Waiter } from './waiter';

import type { Page } from './page';
import type * as api from '../../types/types';
import type * as channels from './channels';
import type { WaitForEventOptions } from './types';

export type WebMCPTool = {
  name: string;
  description: string;
  inputSchema?: any;
  annotations?: {
    readOnly?: boolean;
    untrustedContent?: boolean;
    consequential?: boolean;
  };
  frame: Frame;
};

export class WebMCP extends EventEmitter implements api.WebMCP {
  private _page: Page;

  constructor(page: Page) {
    super();
    this.setMaxListeners(0);
    this._page = page;
    this._page._channel.on('webmcpToolsChanged', ({ tools }) => this.emit(Events.WebMCP.ToolsChanged, tools.map(fromProtocol)));
  }

  async enable(): Promise<DisposableStub> {
    await this._page._channel.webmcpEnable({}, kNoTimeout);
    return new DisposableStub(() => this.disable());
  }

  async disable(): Promise<void> {
    await this._page._channel.webmcpDisable({}, kNoTimeout);
  }

  async tools(options: { timeout?: number } = {}): Promise<WebMCPTool[]> {
    const { tools } = await this._page._channel.webmcpTools({}, this._page._timeoutSettings.timeout(options));
    return tools.map(fromProtocol);
  }

  async callTool(name: string, input?: any, options: { frame?: Frame, timeout?: number } = {}): Promise<any> {
    const { result } = await this._page._channel.webmcpCallTool({ name, input, frame: options.frame?._channel }, this._page._timeoutSettings.timeout(options));
    return result;
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return await this._page._wrapApiCall(async () => {
      const timeoutOptions = this._page._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this._page, event);
      waiter.rejectOnTimeout(timeoutOptions, `Timeout ${timeoutOptions.timeout}ms exceeded while waiting for event "${event}"`);
      waiter.rejectOnEvent(this._page, Events.Page.Close, () => this._page._closeErrorWithReason());
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }
}

function fromProtocol(tool: channels.PageWebmcpToolsResult['tools'][number]): WebMCPTool {
  return { ...tool, frame: Frame.from(tool.frame) };
}
