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
import { setTestIdAttribute } from './locator';

import type { SelectorEngine } from './types';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';
import type { Playwright } from './playwright';

export class Selectors implements api.Selectors {
  _playwrights = new Set<Playwright>();
  _selectorEngines: channels.SelectorEngine[] = [];
  _testIdAttributeName: string | undefined;

  async register(name: string, script: string | (() => SelectorEngine) | { path?: string, content?: string }, options: { contentScript?: boolean } = {}): Promise<void> {
    const platform = this._playwrights.values().next().value!._platform;
    const source = await evaluationScript(platform, script, undefined, false);
    const selectorEngine: channels.SelectorEngine = { ...options, name, source };
    for (const playwright of this._playwrights) {
      for (const context of playwright._allContexts())
        await context._channel.registerSelectorEngine({ selectorEngine });
    }
    this._selectorEngines.push(selectorEngine);
  }

  setTestIdAttribute(attributeName: string) {
    this._testIdAttributeName = attributeName;
    setTestIdAttribute(attributeName);
    for (const playwright of this._playwrights) {
      for (const context of playwright._allContexts())
        context._channel.setTestIdAttributeName({ testIdAttributeName: attributeName }).catch(() => {});
    }
  }
}
