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

import { evaluationScript } from './clientHelper';
import type { BrowserContext } from './browserContext';
import * as channels from '../protocol/channels';

export class Selectors {
  private _contexts = new Set<BrowserContext>();
  private _registrations: channels.BrowserContextRegisterSelectorEngineParams[] = [];

  async register(name: string, script: string | Function | { path?: string, content?: string }, options: { contentScript?: boolean } = {}): Promise<void> {
    const source = await evaluationScript(script, undefined, false);
    const params = { ...options, name, source };
    for (const context of this._contexts)
      await context._channel.registerSelectorEngine(params);
    this._registrations.push(params);
  }

  _addContext(context: BrowserContext) {
    this._contexts.add(context);
    for (const params of this._registrations) {
      // This should not fail except for connection closure, but just in case we catch.
      context._channel.registerSelectorEngine(params).catch(e => {});
    }
  }

  _removeContext(context: BrowserContext) {
    this._contexts.delete(context);
  }
}
