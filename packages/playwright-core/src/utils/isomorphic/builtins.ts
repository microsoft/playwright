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
  eval: typeof window['eval'],
  Intl: typeof window['Intl'],
  Date: typeof window['Date'],
  Map: typeof window['Map'],
  Set: typeof window['Set'],
};

// Builtins are created once lazily upon the first import of this module, see "instance" below.
// This is how it works in Node.js environment, or when something goes unexpectedly in the browser.
//
// However, the same "builtins()" function is also evaluated inside an InitScript before
// anything else happens in the page. This way, original builtins are saved on the global object
// before page can temper with them. Later on, any call to builtins() will retrieve the stored
// builtins instead of initializing them again.
export function builtins(global?: typeof globalThis): Builtins {
  global = global ?? globalThis;
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

const instance = builtins();
export const setTimeout = instance.setTimeout;
export const clearTimeout = instance.clearTimeout;
export const setInterval = instance.setInterval;
export const clearInterval = instance.clearInterval;
export const requestAnimationFrame = instance.requestAnimationFrame;
export const cancelAnimationFrame = instance.cancelAnimationFrame;
export const requestIdleCallback = instance.requestIdleCallback;
export const cancelIdleCallback = instance.cancelIdleCallback;
export const performance = instance.performance;
export const Intl = instance.Intl;
export const Date = instance.Date;
export const Map = instance.Map;
export const Set = instance.Set;
