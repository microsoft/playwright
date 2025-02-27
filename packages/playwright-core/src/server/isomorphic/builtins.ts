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

/* eslint-disable no-restricted-globals */

// Make sure to update eslint.config.mjs when changing the list of builitins.
export type Builtins = {
  setTimeout: Window['setTimeout'],
  clearTimeout: Window['clearTimeout'],
  setInterval: Window['setInterval'],
  clearInterval: Window['clearInterval'],
  requestAnimationFrame: Window['requestAnimationFrame'],
  cancelAnimationFrame: Window['cancelAnimationFrame'],
  requestIdleCallback: Window['requestIdleCallback'],
  cancelIdleCallback: (id: number) => void,
  performance: Window['performance'],
  eval: typeof eval,
  Intl: typeof Intl,
  Date: typeof Date,
  Map: typeof Map,
  Set: typeof Set,
};

type OriginalMap<K, V> = Map<K, V>;
type OriginalSet<T> = Set<T>;
type OriginalDate = Date;
export namespace Builtins {
  export type Map<K, V> = OriginalMap<K, V>;
  export type Set<T> = OriginalSet<T>;
  export type Date = OriginalDate;
}

export function createBuiltins(window: typeof globalThis): Builtins {
  return {
    setTimeout: window.setTimeout?.bind(window),
    clearTimeout: window.clearTimeout?.bind(window),
    setInterval: window.setInterval?.bind(window),
    clearInterval: window.clearInterval?.bind(window),
    requestAnimationFrame: window.requestAnimationFrame?.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame?.bind(window),
    requestIdleCallback: window.requestIdleCallback?.bind(window),
    cancelIdleCallback: window.cancelIdleCallback?.bind(window),
    performance: window.performance,
    eval: window.eval?.bind(window),
    Intl: window.Intl,
    Date: window.Date,
    Map: window.Map,
    Set: window.Set,
  };
}

export function createBuiltinsScript(builtinsProperty: string) {
  return `Object.defineProperty(globalThis, "${builtinsProperty}", { value: (${createBuiltins.toString()})(globalThis), configurable: false, enumerable: false, writable: false });`;
}

export function retrieveBuiltinsScript(builtinsProperty: string) {
  return `(globalThis['${builtinsProperty}'] || (${createBuiltins.toString()})(globalThis))`;
}
