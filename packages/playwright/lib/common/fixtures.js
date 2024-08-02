"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FixturePool = void 0;
exports.fixtureParameterNames = fixtureParameterNames;
exports.inheritFixtureNames = inheritFixtureNames;
var _util = require("../util");
var crypto = _interopRequireWildcard(require("crypto"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

const kScopeOrder = ['test', 'worker'];
function isFixtureTuple(value) {
  return Array.isArray(value) && typeof value[1] === 'object' && ('scope' in value[1] || 'auto' in value[1] || 'option' in value[1] || 'timeout' in value[1]);
}
function isFixtureOption(value) {
  return isFixtureTuple(value) && !!value[1].option;
}
class FixturePool {
  constructor(fixturesList, onLoadError, parentPool, disallowWorkerFixtures, optionOverrides) {
    var _optionOverrides$over;
    this.digest = void 0;
    this._registrations = void 0;
    this._onLoadError = void 0;
    this._registrations = new Map(parentPool ? parentPool._registrations : []);
    this._onLoadError = onLoadError;
    const allOverrides = (_optionOverrides$over = optionOverrides === null || optionOverrides === void 0 ? void 0 : optionOverrides.overrides) !== null && _optionOverrides$over !== void 0 ? _optionOverrides$over : {};
    const overrideKeys = new Set(Object.keys(allOverrides));
    for (const list of fixturesList) {
      this._appendFixtureList(list, !!disallowWorkerFixtures, false);

      // Process option overrides immediately after original option definitions,
      // so that any test.use() override it.
      const selectedOverrides = {};
      for (const [key, value] of Object.entries(list.fixtures)) {
        if (isFixtureOption(value) && overrideKeys.has(key)) selectedOverrides[key] = [allOverrides[key], value[1]];
      }
      if (Object.entries(selectedOverrides).length) this._appendFixtureList({
        fixtures: selectedOverrides,
        location: optionOverrides.location
      }, !!disallowWorkerFixtures, true);
    }
    this.digest = this.validate();
  }
  _appendFixtureList(list, disallowWorkerFixtures, isOptionsOverride) {
    const {
      fixtures,
      location
    } = list;
    for (const entry of Object.entries(fixtures)) {
      const name = entry[0];
      let value = entry[1];
      let options;
      if (isFixtureTuple(value)) {
        var _value$1$auto;
        options = {
          auto: (_value$1$auto = value[1].auto) !== null && _value$1$auto !== void 0 ? _value$1$auto : false,
          scope: value[1].scope || 'test',
          option: !!value[1].option,
          timeout: value[1].timeout,
          customTitle: value[1]._title,
          hideStep: value[1]._hideStep
        };
        value = value[0];
      }
      let fn = value;
      const previous = this._registrations.get(name);
      if (previous && options) {
        if (previous.scope !== options.scope) {
          this._addLoadError(`Fixture "${name}" has already been registered as a { scope: '${previous.scope}' } fixture defined in ${(0, _util.formatLocation)(previous.location)}.`, location);
          continue;
        }
        if (previous.auto !== options.auto) {
          this._addLoadError(`Fixture "${name}" has already been registered as a { auto: '${previous.scope}' } fixture defined in ${(0, _util.formatLocation)(previous.location)}.`, location);
          continue;
        }
      } else if (previous) {
        options = {
          auto: previous.auto,
          scope: previous.scope,
          option: previous.option,
          timeout: previous.timeout,
          customTitle: previous.customTitle,
          hideStep: undefined
        };
      } else if (!options) {
        options = {
          auto: false,
          scope: 'test',
          option: false,
          timeout: undefined,
          customTitle: undefined,
          hideStep: undefined
        };
      }
      if (!kScopeOrder.includes(options.scope)) {
        this._addLoadError(`Fixture "${name}" has unknown { scope: '${options.scope}' }.`, location);
        continue;
      }
      if (options.scope === 'worker' && disallowWorkerFixtures) {
        this._addLoadError(`Cannot use({ ${name} }) in a describe group, because it forces a new worker.\nMake it top-level in the test file or put in the configuration file.`, location);
        continue;
      }

      // Overriding option with "undefined" value means setting it to the default value
      // from the config or from the original declaration of the option.
      if (fn === undefined && options.option && previous) {
        let original = previous;
        while (!original.optionOverride && original.super) original = original.super;
        fn = original.fn;
      }
      const deps = fixtureParameterNames(fn, location, e => this._onLoadError(e));
      const registration = {
        id: '',
        name,
        location,
        scope: options.scope,
        fn,
        auto: options.auto,
        option: options.option,
        timeout: options.timeout,
        customTitle: options.customTitle,
        hideStep: options.hideStep,
        deps,
        super: previous,
        optionOverride: isOptionsOverride
      };
      registrationId(registration);
      this._registrations.set(name, registration);
    }
  }
  validate() {
    const markers = new Map();
    const stack = [];
    const visit = registration => {
      markers.set(registration, 'visiting');
      stack.push(registration);
      for (const name of registration.deps) {
        const dep = this.resolve(name, registration);
        if (!dep) {
          if (name === registration.name) this._addLoadError(`Fixture "${registration.name}" references itself, but does not have a base implementation.`, registration.location);else this._addLoadError(`Fixture "${registration.name}" has unknown parameter "${name}".`, registration.location);
          continue;
        }
        if (kScopeOrder.indexOf(registration.scope) > kScopeOrder.indexOf(dep.scope)) {
          this._addLoadError(`${registration.scope} fixture "${registration.name}" cannot depend on a ${dep.scope} fixture "${name}" defined in ${(0, _util.formatLocation)(dep.location)}.`, registration.location);
          continue;
        }
        if (!markers.has(dep)) {
          visit(dep);
        } else if (markers.get(dep) === 'visiting') {
          const index = stack.indexOf(dep);
          const regs = stack.slice(index, stack.length);
          const names = regs.map(r => `"${r.name}"`);
          this._addLoadError(`Fixtures ${names.join(' -> ')} -> "${dep.name}" form a dependency cycle: ${regs.map(r => (0, _util.formatLocation)(r.location)).join(' -> ')}`, dep.location);
          continue;
        }
      }
      markers.set(registration, 'visited');
      stack.pop();
    };
    const hash = crypto.createHash('sha1');
    const names = Array.from(this._registrations.keys()).sort();
    for (const name of names) {
      const registration = this._registrations.get(name);
      visit(registration);
      if (registration.scope === 'worker') hash.update(registration.id + ';');
    }
    return hash.digest('hex');
  }
  validateFunction(fn, prefix, location) {
    for (const name of fixtureParameterNames(fn, location, e => this._onLoadError(e))) {
      const registration = this._registrations.get(name);
      if (!registration) this._addLoadError(`${prefix} has unknown parameter "${name}".`, location);
    }
  }
  resolve(name, forFixture) {
    if (name === (forFixture === null || forFixture === void 0 ? void 0 : forFixture.name)) return forFixture.super;
    return this._registrations.get(name);
  }
  autoFixtures() {
    return [...this._registrations.values()].filter(r => r.auto !== false);
  }
  _addLoadError(message, location) {
    this._onLoadError({
      message,
      location
    });
  }
}
exports.FixturePool = FixturePool;
const signatureSymbol = Symbol('signature');
function fixtureParameterNames(fn, location, onError) {
  if (typeof fn !== 'function') return [];
  if (!fn[signatureSymbol]) fn[signatureSymbol] = innerFixtureParameterNames(fn, location, onError);
  return fn[signatureSymbol];
}
function inheritFixtureNames(from, to) {
  to[signatureSymbol] = from[signatureSymbol];
}
function innerFixtureParameterNames(fn, location, onError) {
  const text = filterOutComments(fn.toString());
  const match = text.match(/(?:async)?(?:\s+function)?[^(]*\(([^)]*)/);
  if (!match) return [];
  const trimmedParams = match[1].trim();
  if (!trimmedParams) return [];
  const [firstParam] = splitByComma(trimmedParams);
  if (firstParam[0] !== '{' || firstParam[firstParam.length - 1] !== '}') {
    onError({
      message: 'First argument must use the object destructuring pattern: ' + firstParam,
      location
    });
    return [];
  }
  const props = splitByComma(firstParam.substring(1, firstParam.length - 1)).map(prop => {
    const colon = prop.indexOf(':');
    return colon === -1 ? prop.trim() : prop.substring(0, colon).trim();
  });
  const restProperty = props.find(prop => prop.startsWith('...'));
  if (restProperty) {
    onError({
      message: `Rest property "${restProperty}" is not supported. List all used fixtures explicitly, separated by comma.`,
      location
    });
    return [];
  }
  return props;
}
function filterOutComments(s) {
  const result = [];
  let commentState = 'none';
  for (let i = 0; i < s.length; ++i) {
    if (commentState === 'singleline') {
      if (s[i] === '\n') commentState = 'none';
    } else if (commentState === 'multiline') {
      if (s[i - 1] === '*' && s[i] === '/') commentState = 'none';
    } else if (commentState === 'none') {
      if (s[i] === '/' && s[i + 1] === '/') {
        commentState = 'singleline';
      } else if (s[i] === '/' && s[i + 1] === '*') {
        commentState = 'multiline';
        i += 2;
      } else {
        result.push(s[i]);
      }
    }
  }
  return result.join('');
}
function splitByComma(s) {
  const result = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']');
    } else if (s[i] === stack[stack.length - 1]) {
      stack.pop();
    } else if (!stack.length && s[i] === ',') {
      const token = s.substring(start, i).trim();
      if (token) result.push(token);
      start = i + 1;
    }
  }
  const lastToken = s.substring(start).trim();
  if (lastToken) result.push(lastToken);
  return result;
}

// name + superId, fn -> id
const registrationIdMap = new Map();
let lastId = 0;
function registrationId(registration) {
  if (registration.id) return registration.id;
  const key = registration.name + '@@@' + (registration.super ? registrationId(registration.super) : '');
  let map = registrationIdMap.get(key);
  if (!map) {
    map = new Map();
    registrationIdMap.set(key, map);
  }
  if (!map.has(registration.fn)) map.set(registration.fn, String(lastId++));
  registration.id = map.get(registration.fn);
  return registration.id;
}