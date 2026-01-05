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

import type * as api from '../../types/types';
import type { Page } from './page';
import type z from 'zod';

export class PageAgent implements api.PageAgent {
  private _page: Page;

  constructor(page: Page) {
    this._page = page;
  }

  async expect(expectation: string, options: { maxTokens?: number, maxTurns?: number } = {}) {
    await this._page._channel.agentExpect({ expectation, ...options });
  }

  async perform(task: string, options: { key?: string, maxTokens?: number, maxTurns?: number } = {}) {
    const result = await this._page._channel.agentPerform({ task, ...options });
    return { usage: { ...result } };
  }

  async extract<Schema extends z.ZodTypeAny>(query: string, schema: Schema, options: { maxTokens?: number, maxTurns?: number } = {}): Promise<z.infer<Schema>> {
    const { result, ...usage } = await this._page._channel.agentExtract({ query, schema: this._page._platform.zodToJsonSchema(schema), ...options });
    return { result, usage };
  }
}
