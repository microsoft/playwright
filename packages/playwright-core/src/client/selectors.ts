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
import type { BrowserContext } from './browserContext';
import type { Platform } from './platform';

export class Selectors implements api.Selectors {
  private _platform: Platform;
  private _selectorEngines: channels.SelectorEngine[] = [];
  private _testIdAttributeName: string | undefined;
  readonly _contextsForSelectors = new Set<BrowserContext>();

  constructor(platform: Platform) {
    this._platform = platform;
  }

  async register(name: string, script: string | (() => SelectorEngine) | { path?: string, content?: string }, options: { contentScript?: boolean } = {}): Promise<void> {
    if (this._selectorEngines.some(engine => engine.name === name))
      throw new Error(`selectors.register: "${name}" selector engine has been already registered`);

    const source = await evaluationScript(this._platform, script, undefined, false);
    const selectorEngine: channels.SelectorEngine = { ...options, name, source };
    for (const context of this._contextsForSelectors)
      await context._channel.registerSelectorEngine({ selectorEngine });
    this._selectorEngines.push(selectorEngine);
  }

  setTestIdAttribute(attributeName: string) {
    this._testIdAttributeName = attributeName;
    setTestIdAttribute(attributeName);
    for (const context of this._contextsForSelectors)
      context._channel.setTestIdAttributeName({ testIdAttributeName: attributeName }).catch(() => {});
  }

  _withSelectorOptions<T>(options: T) {
    return { ...options, selectorEngines: this._selectorEngines, testIdAttributeName: this._testIdAttributeName };
  }
}
