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

export function ensureBuiltins(global: typeof globalThis): Builtins {
  if (!(global as any)['__playwright_builtins__']) {
    const builtins: Builtins = {
      setTimeout: global.setTimeout?.bind(global),
      clearTimeout: global.clearTimeout?.bind(global),
      setInterval: global.setInterval?.bind(global),
      clearInterval: global.clearInterval?.bind(global),
      requestAnimationFrame: global.requestAnimationFrame?.bind(global),
      cancelAnimationFrame: global.cancelAnimationFrame?.bind(global),
      requestIdleCallback: global.requestIdleCallback?.bind(global),
      cancelIdleCallback: global.cancelIdleCallback?.bind(global),
      performance: global.performance,
      eval: global.eval?.bind(global),
      Intl: global.Intl,
      Date: global.Date,
      Map: global.Map,
      Set: global.Set,
    };
    Object.defineProperty(global, '__playwright_builtins__', { value: builtins, configurable: false, enumerable: false, writable: false });
  }
  return (global as any)['__playwright_builtins__'];
}
