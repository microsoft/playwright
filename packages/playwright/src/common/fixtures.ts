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

import crypto from 'crypto';

import { filterStackFile, formatLocation } from '../util';

import type { FixturesWithLocation } from './config';
import type { Fixtures } from '../../types/test';
import type { Location } from '../../types/testReporter';

export type FixtureScope = 'test' | 'worker';
type FixtureAuto = boolean | 'all-hooks-included';
const kScopeOrder: FixtureScope[] = ['test', 'worker'];
type FixtureOptions = { auto?: FixtureAuto, scope?: FixtureScope, option?: boolean, timeout?: number | undefined, title?: string, box?: boolean };
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
  // Do not generate the step for this fixture, consider it internal.
  box?: boolean;
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
  return Array.isArray(value) && typeof value[1] === 'object';
}

function isFixtureOption(value: any): value is FixtureTuple {
  return isFixtureTuple(value) && !!value[1].option;
}

export class FixturePool {
  readonly digest: string;
  private readonly _registrations: Map<string, FixtureRegistration>;
  private _onLoadError: LoadErrorSink;

  constructor(fixturesList: FixturesWithLocation[], onLoadError: LoadErrorSink, parentPool?: FixturePool, disallowWorkerFixtures?: boolean, optionOverrides?: OptionOverrides) {
    this._registrations = new Map(parentPool ? parentPool._registrations : []);
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
      let options: { auto: FixtureAuto, scope: FixtureScope, option: boolean, timeout: number | undefined, customTitle?: string, box?: boolean } | undefined;
      if (isFixtureTuple(value)) {
        options = {
          auto: value[1].auto ?? false,
          scope: value[1].scope || 'test',
          option: !!value[1].option,
          timeout: value[1].timeout,
          customTitle: value[1].title,
          box: value[1].box,
        };
        value = value[0];
      }
      let fn = value as (Function | any);

      const previous = this._registrations.get(name);
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
        options = { auto: previous.auto, scope: previous.scope, option: previous.option, timeout: previous.timeout, customTitle: previous.customTitle, box: previous.box };
      } else if (!options) {
        options = { auto: false, scope: 'test', option: false, timeout: undefined };
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
      const registration: FixtureRegistration = { id: '', name, location, scope: options.scope, fn, auto: options.auto, option: options.option, timeout: options.timeout, customTitle: options.customTitle, box: options.box, deps, super: previous, optionOverride: isOptionsOverride };
      registrationId(registration);
      this._registrations.set(name, registration);
    }
  }

  private validate() {
    const markers = new Map<FixtureRegistration, 'visiting' | 'visited'>();
    const stack: FixtureRegistration[] = [];
    let hasDependencyErrors = false;
    const addDependencyError = (message: string, location: Location) => {
      hasDependencyErrors = true;
      this._addLoadError(message, location);
    };
    const visit = (registration: FixtureRegistration, boxedOnly: boolean) => {
      markers.set(registration, 'visiting');
      stack.push(registration);
      for (const name of registration.deps) {
        const dep = this.resolve(name, registration);
        if (!dep) {
          if (name === registration.name)
            addDependencyError(`Fixture "${registration.name}" references itself, but does not have a base implementation.`, registration.location);
          else
            addDependencyError(`Fixture "${registration.name}" has unknown parameter "${name}".`, registration.location);
          continue;
        }
        if (kScopeOrder.indexOf(registration.scope) > kScopeOrder.indexOf(dep.scope)) {
          addDependencyError(`${registration.scope} fixture "${registration.name}" cannot depend on a ${dep.scope} fixture "${name}" defined in ${formatPotentiallyInternalLocation(dep.location)}.`, registration.location);
          continue;
        }
        if (!markers.has(dep)) {
          visit(dep, boxedOnly);
        } else if (markers.get(dep) === 'visiting') {
          const index = stack.indexOf(dep);
          const allRegs = stack.slice(index, stack.length);
          const filteredRegs = allRegs.filter(r => !r.box);
          const regs = boxedOnly ? filteredRegs : allRegs;
          const names = regs.map(r => `"${r.name}"`);
          addDependencyError(`Fixtures ${names.join(' -> ')} -> "${dep.name}" form a dependency cycle: ${regs.map(r => formatPotentiallyInternalLocation(r.location)).join(' -> ')} -> ${formatPotentiallyInternalLocation(dep.location)}`, dep.location);
          continue;
        }
      }
      markers.set(registration, 'visited');
      stack.pop();
    };

    const names = Array.from(this._registrations.keys()).sort();

    // First iterate over non-boxed fixtures to provide clear error messages.
    for (const name of names) {
      const registration = this._registrations.get(name)!;
      if (!registration.box)
        visit(registration, true);
    }

    // If no errors found, iterate over boxed fixtures
    if (!hasDependencyErrors) {
      for (const name of names) {
        const registration = this._registrations.get(name)!;
        if (registration.box)
          visit(registration, false);
      }
    }

    const hash = crypto.createHash('sha1');
    for (const name of names) {
      const registration = this._registrations.get(name)!;
      if (registration.scope === 'worker')
        hash.update(registration.id + ';');
    }
    return hash.digest('hex');
  }

  validateFunction(fn: Function, prefix: string, location: Location) {
    for (const name of fixtureParameterNames(fn, location, e => this._onLoadError(e))) {
      const registration = this._registrations.get(name);
      if (!registration)
        this._addLoadError(`${prefix} has unknown parameter "${name}".`, location);
    }
  }

  resolve(name: string, forFixture?: FixtureRegistration): FixtureRegistration | undefined {
    if (name === forFixture?.name)
      return forFixture.super;
    return this._registrations.get(name);
  }

  autoFixtures() {
    return [...this._registrations.values()].filter(r => r.auto !== false);
  }

  private _addLoadError(message: string, location: Location) {
    this._onLoadError({ message, location });
  }
}

const signatureSymbol = Symbol('signature');

export function formatPotentiallyInternalLocation(location: Location): string {
  const isUserFixture = location && filterStackFile(location.file);
  return isUserFixture ? formatLocation(location) : '<builtin>';
}

export function fixtureParameterNames(fn: Function | any, location: Location, onError: LoadErrorSink): string[] {
  if (typeof fn !== 'function')
    return [];
  if (!fn[signatureSymbol])
    fn[signatureSymbol] = innerFixtureParameterNames(fn, location, onError);
  return fn[signatureSymbol];
}

export function inheritFixtureNames(from: Function, to: Function) {
  (to as any)[signatureSymbol] = (from as any)[signatureSymbol];
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
  const restProperty = props.find(prop => prop.startsWith('...'));
  if (restProperty) {
    onError({ message: `Rest property "${restProperty}" is not supported. List all used fixtures explicitly, separated by comma.`, location });
    return [];
  }
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
