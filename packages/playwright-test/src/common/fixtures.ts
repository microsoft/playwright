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

import { formatLocation } from '../util';
import * as crypto from 'crypto';
import type { Fixtures, FixturesWithLocation, Location } from './types';

export type FixtureScope = 'test' | 'worker';
type FixtureAuto = boolean | 'all-hooks-included';
const kScopeOrder: FixtureScope[] = ['test', 'worker'];
type FixtureOptions = { auto?: FixtureAuto, scope?: FixtureScope, option?: boolean, timeout?: number | undefined };
type FixtureTuple = [ value: any, options: FixtureOptions ];
export type FixtureRegistration = {
  // Fixture registration location.
  location: Location;
  // Fixture name comes from test.extend() call.
  name: string;
  scope: FixtureScope;
  // Either a fixture function, or a fixture value.
  fn: Function | any;
  // Auto fixtures always run without user explicitly mentioning them.
  auto: FixtureAuto;
  // An "option" fixture can have a value set in the config.
  option: boolean;
  // Custom title to be used instead of the name, internal-only.
  customTitle?: string;
  // Fixture with a separate timeout does not count towards the test time.
  timeout?: number;
  // Names of the dependencies, comes from the declaration "({ foo, bar }) => {...}"
  deps: string[];
  // Unique id, to differentiate between fixtures with the same name.
  id: string;
  // A fixture override can use the previous version of the fixture.
  super?: FixtureRegistration;
  // Whether this fixture is an option override value set from the config.
  optionOverride?: boolean;
};
export type LoadError = {
  message: string;
  location: Location;
};
type LoadErrorSink = (error: LoadError) => void;
type OptionOverrides = {
  overrides: Fixtures,
  location: Location,
};

function isFixtureTuple(value: any): value is FixtureTuple {
  return Array.isArray(value) && typeof value[1] === 'object' && ('scope' in value[1] || 'auto' in value[1] || 'option' in value[1] || 'timeout' in value[1]);
}

function isFixtureOption(value: any): value is FixtureTuple {
  return isFixtureTuple(value) && !!value[1].option;
}

export class FixturePool {
  readonly digest: string;
  readonly registrations: Map<string, FixtureRegistration>;
  private _onLoadError: LoadErrorSink;

  constructor(fixturesList: FixturesWithLocation[], onLoadError: LoadErrorSink, parentPool?: FixturePool, disallowWorkerFixtures?: boolean, optionOverrides?: OptionOverrides) {
    this.registrations = new Map(parentPool ? parentPool.registrations : []);
    this._onLoadError = onLoadError;

    const allOverrides = optionOverrides?.overrides ?? {};
    const overrideKeys = new Set(Object.keys(allOverrides));
    for (const list of fixturesList) {
      this._appendFixtureList(list, !!disallowWorkerFixtures, false);

      // Process option overrides immediately after original option definitions,
      // so that any test.use() override it.
      const selectedOverrides: Fixtures = {};
      for (const [key, value] of Object.entries(list.fixtures)) {
        if (isFixtureOption(value) && overrideKeys.has(key))
          (selectedOverrides as any)[key] = [(allOverrides as any)[key], value[1]];
      }
      if (Object.entries(selectedOverrides).length)
        this._appendFixtureList({ fixtures: selectedOverrides, location: optionOverrides!.location }, !!disallowWorkerFixtures, true);
    }

    this.digest = this.validate();
  }

  private _appendFixtureList(list: FixturesWithLocation, disallowWorkerFixtures: boolean, isOptionsOverride: boolean) {
    const { fixtures, location } = list;
    for (const entry of Object.entries(fixtures)) {
      const name = entry[0];
      let value = entry[1];
      let options: { auto: FixtureAuto, scope: FixtureScope, option: boolean, timeout: number | undefined, customTitle: string | undefined } | undefined;
      if (isFixtureTuple(value)) {
        options = {
          auto: value[1].auto ?? false,
          scope: value[1].scope || 'test',
          option: !!value[1].option,
          timeout: value[1].timeout,
          customTitle: (value[1] as any)._title,
        };
        value = value[0];
      }
      let fn = value as (Function | any);

      const previous = this.registrations.get(name);
      if (previous && options) {
        if (previous.scope !== options.scope) {
          this._addLoadError(`Fixture "${name}" has already been registered as a { scope: '${previous.scope}' } fixture defined in ${formatLocation(previous.location)}.`, location);
          continue;
        }
        if (previous.auto !== options.auto) {
          this._addLoadError(`Fixture "${name}" has already been registered as a { auto: '${previous.scope}' } fixture defined in ${formatLocation(previous.location)}.`, location);
          continue;
        }
      } else if (previous) {
        options = { auto: previous.auto, scope: previous.scope, option: previous.option, timeout: previous.timeout, customTitle: previous.customTitle };
      } else if (!options) {
        options = { auto: false, scope: 'test', option: false, timeout: undefined, customTitle: undefined };
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
        while (!original.optionOverride && original.super)
          original = original.super;
        fn = original.fn;
      }

      const deps = fixtureParameterNames(fn, location, e => this._onLoadError(e));
      const registration: FixtureRegistration = { id: '', name, location, scope: options.scope, fn, auto: options.auto, option: options.option, timeout: options.timeout, customTitle: options.customTitle, deps, super: previous, optionOverride: isOptionsOverride };
      registrationId(registration);
      this.registrations.set(name, registration);
    }
  }

  private validate() {
    const markers = new Map<FixtureRegistration, 'visiting' | 'visited'>();
    const stack: FixtureRegistration[] = [];
    const visit = (registration: FixtureRegistration) => {
      markers.set(registration, 'visiting');
      stack.push(registration);
      for (const name of registration.deps) {
        const dep = this.resolveDependency(registration, name);
        if (!dep) {
          if (name === registration.name)
            this._addLoadError(`Fixture "${registration.name}" references itself, but does not have a base implementation.`, registration.location);
          else
            this._addLoadError(`Fixture "${registration.name}" has unknown parameter "${name}".`, registration.location);
          continue;
        }
        if (kScopeOrder.indexOf(registration.scope) > kScopeOrder.indexOf(dep.scope)) {
          this._addLoadError(`${registration.scope} fixture "${registration.name}" cannot depend on a ${dep.scope} fixture "${name}" defined in ${formatLocation(dep.location)}.`, registration.location);
          continue;
        }
        if (!markers.has(dep)) {
          visit(dep);
        } else if (markers.get(dep) === 'visiting') {
          const index = stack.indexOf(dep);
          const regs = stack.slice(index, stack.length);
          const names = regs.map(r => `"${r.name}"`);
          this._addLoadError(`Fixtures ${names.join(' -> ')} -> "${dep.name}" form a dependency cycle: ${regs.map(r => formatLocation(r.location)).join(' -> ')}`, dep.location);
          continue;
        }
      }
      markers.set(registration, 'visited');
      stack.pop();
    };

    const hash = crypto.createHash('sha1');
    const names = Array.from(this.registrations.keys()).sort();
    for (const name of names) {
      const registration = this.registrations.get(name)!;
      visit(registration);
      if (registration.scope === 'worker')
        hash.update(registration.id + ';');
    }
    return hash.digest('hex');
  }

  validateFunction(fn: Function, prefix: string, location: Location) {
    for (const name of fixtureParameterNames(fn, location, e => this._onLoadError(e))) {
      const registration = this.registrations.get(name);
      if (!registration)
        this._addLoadError(`${prefix} has unknown parameter "${name}".`, location);
    }
  }

  resolveDependency(registration: FixtureRegistration, name: string): FixtureRegistration | undefined {
    if (name === registration.name)
      return registration.super;
    return this.registrations.get(name);
  }

  private _addLoadError(message: string, location: Location) {
    this._onLoadError({ message, location });
  }
}

const signatureSymbol = Symbol('signature');

export function fixtureParameterNames(fn: Function | any, location: Location, onError: LoadErrorSink): string[] {
  if (typeof fn !== 'function')
    return [];
  if (!fn[signatureSymbol])
    fn[signatureSymbol] = innerFixtureParameterNames(fn, location, onError);
  return fn[signatureSymbol];
}

function innerFixtureParameterNames(fn: Function, location: Location, onError: LoadErrorSink): string[] {
  const text = filterOutComments(fn.toString());
  const match = text.match(/(?:async)?(?:\s+function)?[^(]*\(([^)]*)/);
  if (!match)
    return [];
  const trimmedParams = match[1].trim();
  if (!trimmedParams)
    return [];
  const [firstParam] = splitByComma(trimmedParams);
  if (firstParam[0] !== '{' || firstParam[firstParam.length - 1] !== '}') {
    onError({ message: 'First argument must use the object destructuring pattern: '  + firstParam, location });
    return [];
  }
  const props = splitByComma(firstParam.substring(1, firstParam.length - 1)).map(prop => {
    const colon = prop.indexOf(':');
    return colon === -1 ? prop.trim() : prop.substring(0, colon).trim();
  });
  return props;
}

function filterOutComments(s: string): string {
  const result: string[] = [];
  let commentState: 'none'|'singleline'|'multiline' = 'none';
  for (let i = 0; i < s.length; ++i) {
    if (commentState === 'singleline') {
      if (s[i] === '\n')
        commentState = 'none';
    } else if (commentState === 'multiline') {
      if (s[i - 1] === '*' && s[i] === '/')
        commentState = 'none';
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

function splitByComma(s: string) {
  const result: string[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']');
    } else if (s[i] === stack[stack.length - 1]) {
      stack.pop();
    } else if (!stack.length && s[i] === ',') {
      const token = s.substring(start, i).trim();
      if (token)
        result.push(token);
      start = i + 1;
    }
  }
  const lastToken = s.substring(start).trim();
  if (lastToken)
    result.push(lastToken);
  return result;
}

// name + superId, fn -> id
const registrationIdMap = new Map<string, Map<Function | any, string>>();
let lastId = 0;

function registrationId(registration: FixtureRegistration): string {
  if (registration.id)
    return registration.id;
  const key = registration.name + '@@@' + (registration.super ?  registrationId(registration.super) : '');
  let map = registrationIdMap.get(key);
  if (!map) {
    map = new Map();
    registrationIdMap.set(key, map);
  }
  if (!map.has(registration.fn))
    map.set(registration.fn, String(lastId++));
  registration.id = map.get(registration.fn)!;
  return registration.id;
}
