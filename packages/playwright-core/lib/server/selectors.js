"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Selectors = void 0;
var _selectorParser = require("../utils/isomorphic/selectorParser");
var _utils = require("../utils");
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

class Selectors {
  constructor() {
    this._builtinEngines = void 0;
    this._builtinEnginesInMainWorld = void 0;
    this._engines = void 0;
    this.guid = `selectors@${(0, _utils.createGuid)()}`;
    this._testIdAttributeName = 'data-testid';
    // Note: keep in sync with InjectedScript class.
    this._builtinEngines = new Set(['css', 'css:light', 'xpath', 'xpath:light', '_react', '_vue', 'text', 'text:light', 'id', 'id:light', 'data-testid', 'data-testid:light', 'data-test-id', 'data-test-id:light', 'data-test', 'data-test:light', 'nth', 'visible', 'internal:control', 'internal:has', 'internal:has-not', 'internal:has-text', 'internal:has-not-text', 'internal:and', 'internal:or', 'internal:chain', 'role', 'internal:attr', 'internal:label', 'internal:text', 'internal:role', 'internal:testid']);
    this._builtinEnginesInMainWorld = new Set(['_react', '_vue']);
    this._engines = new Map();
  }
  async register(name, source, contentScript = false) {
    if (!name.match(/^[a-zA-Z_0-9-]+$/)) throw new Error('Selector engine name may only contain [a-zA-Z0-9_] characters');
    // Note: we keep 'zs' for future use.
    if (this._builtinEngines.has(name) || name === 'zs' || name === 'zs:light') throw new Error(`"${name}" is a predefined selector engine`);
    if (this._engines.has(name)) throw new Error(`"${name}" selector engine has been already registered`);
    this._engines.set(name, {
      source,
      contentScript
    });
  }
  testIdAttributeName() {
    return this._testIdAttributeName;
  }
  setTestIdAttributeName(testIdAttributeName) {
    this._testIdAttributeName = testIdAttributeName;
  }
  unregisterAll() {
    this._engines.clear();
  }
  parseSelector(selector, strict) {
    const parsed = typeof selector === 'string' ? (0, _selectorParser.parseSelector)(selector) : selector;
    let needsMainWorld = false;
    (0, _selectorParser.visitAllSelectorParts)(parsed, part => {
      const name = part.name;
      const custom = this._engines.get(name);
      if (!custom && !this._builtinEngines.has(name)) throw new _selectorParser.InvalidSelectorError(`Unknown engine "${name}" while parsing selector ${(0, _selectorParser.stringifySelector)(parsed)}`);
      if (custom && !custom.contentScript) needsMainWorld = true;
      if (this._builtinEnginesInMainWorld.has(name)) needsMainWorld = true;
    });
    return {
      parsed,
      world: needsMainWorld ? 'main' : 'utility',
      strict
    };
  }
}
exports.Selectors = Selectors;