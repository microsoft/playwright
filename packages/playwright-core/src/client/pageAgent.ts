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
import type z from 'zod';
import type * as channels from '@protocol/channels';

type PageAgentOptions = {
  maxTokens?: number;
  maxTurns?: number;
  cacheKey?: string;
};

export class PageAgent extends ChannelOwner<channels.PageAgentChannel> implements api.PageAgent {
  private _page: Page;

  static from(channel: channels.PageAgentChannel): PageAgent {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.PageAgentInitializer) {
    super(parent, type, guid, initializer);
    this._page = Page.from(initializer.page);
    this._channel.on('turn', params => this.emit(Events.Page.AgentTurn, params));
  }

  async expect(expectation: string, options: PageAgentOptions = {}) {
    await this._channel.expect({ expectation, ...options });
  }

  async perform(task: string, options: PageAgentOptions = {}) {
    const { usage } = await this._channel.perform({ task, ...options });
    return { usage };
  }

  async extract<Schema extends z.ZodTypeAny>(query: string, schema: Schema, options: PageAgentOptions = {}): Promise<z.infer<Schema>> {
    const { result, usage } = await this._channel.extract({ query, schema: this._page._platform.zodToJsonSchema(schema), ...options });
    return { result, usage };
  }

  async dispose() {
    await this._channel.dispose();
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }
}
