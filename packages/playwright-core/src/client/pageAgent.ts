/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { ChannelOwner } from './channelOwner';
import { Events } from './events';
import { Page } from './page';

import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';

export class PageAgent extends ChannelOwner<channels.PageAgentChannel> implements api.PageAgent {
  private _page: Page;
  _expectTimeout?: number;

  static from(channel: channels.PageAgentChannel): PageAgent {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PageAgentInitializer) {
    super(parent, type, guid, initializer);
    this._page = Page.from(initializer.page);
    this._channel.on('turn', params => this.emit(Events.Page.AgentTurn, params));
  }

  async expect(expectation: string, options: channels.PageAgentExpectOptions = {}) {
    const timeout = options.timeout ?? this._expectTimeout ?? 5000;
    await this._channel.expect({ expectation, ...options, timeout });
  }

  async perform(task: string, options: channels.PageAgentPerformOptions = {}) {
    const timeout = this._page._timeoutSettings.timeout(options);
    const { usage } = await this._channel.perform({ task, ...options, timeout });
    return { usage };
  }

  async extract<Schema extends any>(query: string, schema: Schema, options: channels.PageAgentExtractOptions = {}): Promise<{ result: any, usage: channels.AgentUsage }> {
    const timeout = this._page._timeoutSettings.timeout(options);
    const { result, usage } = await this._channel.extract({ query, schema: this._page._platform.zodToJsonSchema(schema), ...options, timeout });
    return { result, usage };
  }

  async usage() {
    const { usage } = await this._channel.usage({});
    return usage;
  }

  async dispose() {
    await this._channel.dispose();
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }
}
