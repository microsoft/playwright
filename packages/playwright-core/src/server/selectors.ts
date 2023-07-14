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

import { visitAllSelectorParts, InvalidSelectorError, type ParsedSelector, parseSelector, stringifySelector } from '../utils/isomorphic/selectorParser';
import { createGuid } from '../utils';

export class Selectors {
  private readonly _builtinEngines: Set<string>;
  private readonly _builtinEnginesInMainWorld: Set<string>;
  readonly _engines: Map<string, { source: string, contentScript: boolean }>;
  readonly guid = `selectors@${createGuid()}`;
  private _testIdAttributeName: string = 'data-testid';

  constructor() {
    // Note: keep in sync with InjectedScript class.
    this._builtinEngines = new Set([
      'css', 'css:light',
      'xpath', 'xpath:light',
      '_react', '_vue',
      'text', 'text:light',
      'id', 'id:light',
      'data-testid', 'data-testid:light',
      'data-test-id', 'data-test-id:light',
      'data-test', 'data-test:light',
      'nth', 'visible', 'internal:control',
      'internal:has', 'internal:has-not',
      'internal:has-text', 'internal:has-not-text',
      'internal:and', 'internal:or', 'internal:chain',
      'role', 'internal:attr', 'internal:label', 'internal:text', 'internal:role', 'internal:testid',
    ]);
    this._builtinEnginesInMainWorld = new Set([
      '_react', '_vue',
    ]);
    this._engines = new Map();
  }

  async register(name: string, source: string, contentScript: boolean = false): Promise<void> {
    if (!name.match(/^[a-zA-Z_0-9-]+$/))
      throw new Error('Selector engine name may only contain [a-zA-Z0-9_] characters');
    // Note: we keep 'zs' for future use.
    if (this._builtinEngines.has(name) || name === 'zs' || name === 'zs:light')
      throw new Error(`"${name}" is a predefined selector engine`);
    if (this._engines.has(name))
      throw new Error(`"${name}" selector engine has been already registered`);
    this._engines.set(name, { source, contentScript });
  }

  testIdAttributeName(): string {
    return this._testIdAttributeName;
  }

  setTestIdAttributeName(testIdAttributeName: string) {
    this._testIdAttributeName = testIdAttributeName;
  }

  unregisterAll() {
    this._engines.clear();
  }

  parseSelector(selector: string | ParsedSelector, strict: boolean) {
    const parsed = typeof selector === 'string' ? parseSelector(selector) : selector;
    let needsMainWorld = false;
    visitAllSelectorParts(parsed, part => {
      const name = part.name;
      const custom = this._engines.get(name);
      if (!custom && !this._builtinEngines.has(name))
        throw new InvalidSelectorError(`Unknown engine "${name}" while parsing selector ${stringifySelector(parsed)}`);
      if (custom && !custom.contentScript)
        needsMainWorld = true;
      if (this._builtinEnginesInMainWorld.has(name))
        needsMainWorld = true;
    });
    return {
      parsed,
      world: needsMainWorld ? 'main' as const : 'utility' as const,
      strict,
    };
  }
}
