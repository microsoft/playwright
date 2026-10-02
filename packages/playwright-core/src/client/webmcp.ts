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

import { parseResult, serializeArgument } from './jsHandle';

import type { Frame } from './frame';
import type * as api from '../../types/types';
import type * as channels from './channels';

export type WebMCPTool = channels.FrameWebmcpToolsResult['tools'][number];

export class WebMCP implements api.WebMCP {
  private _frame: Frame;

  constructor(frame: Frame) {
    this._frame = frame;
  }

  async tools(options: { timeout?: number } = {}): Promise<WebMCPTool[]> {
    const { tools } = await this._frame._channel.webmcpTools({}, this._frame._timeout(options));
    return tools;
  }

  async callTool(name: string, input?: any, options: { timeout?: number } = {}): Promise<any> {
    const { result } = await this._frame._channel.webmcpCallTool({ name, input: serializeArgument(input) }, this._frame._timeout(options));
    return parseResult(result);
  }
}
