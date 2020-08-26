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

import { Test, Suite } from './test';
import { installTransform } from './transform';

Error.stackTraceLimit = 15;

function specBuilder(modifiers, specCallback) {
  function builder(specs, last) {
    const callable = (...args) => {
      if (!last || (typeof args[0] === 'string' && typeof args[1] === 'function')) {
        // Looks like a body (either it or describe). Assume that last modifier is true.
        const newSpecs = { ...specs };
        if (last)
          newSpecs[last] = [true];
        return specCallback(newSpecs, ...args);
      }
      const newSpecs = { ...specs };
      newSpecs[last] = args;
      return builder(newSpecs, null);
    };
    return new Proxy(callable, {
      get: (obj, prop) => {
        if (typeof prop === 'string' && modifiers.includes(prop)) {
          const newSpecs = { ...specs };
          // Modifier was not called, assume true.
          if (last)
            newSpecs[last] = [true];
          return builder(newSpecs, prop);
        }
        return obj[prop];
      },
    });
  }
  return builder({}, null);
}

export function spec(suite: Suite, file: string, timeout: number): () => void {
  const suites = [suite];
  suite.file = file;

  const it = specBuilder(['skip', 'fail', 'slow', 'only'], (specs, title, fn) => {
    const suite = suites[0];
    const test = new Test(title, fn);
    test.file = file;
    test.slow = specs.slow && specs.slow[0];
    test.timeout = timeout;

    const only = specs.only && specs.only[0];
    if (only)
      test.only = true;
    if (!only && specs.skip && specs.skip[0])
      test._skipped = true;
    if (!only && specs.fail && specs.fail[0])
      test._skipped = true;
    suite._addTest(test);
    return test;
  });

  const describe = specBuilder(['skip', 'fail', 'only'], (specs, title, fn) => {
    const child = new Suite(title, suites[0]);
    suites[0]._addSuite(child);
    child.file = file;
    const only = specs.only && specs.only[0];
    if (only)
      child.only = true;
    if (!only && specs.skip && specs.skip[0])
      child.skipped = true;
    if (!only && specs.fail && specs.fail[0])
      child.skipped = true;
    suites.unshift(child);
    fn();
    suites.shift();
  });

  (global as any).beforeEach = fn => suite._addHook('beforeEach', fn);
  (global as any).afterEach = fn => suite._addHook('afterEach', fn);
  (global as any).beforeAll = fn => suite._addHook('beforeAll', fn);
  (global as any).afterAll = fn => suite._addHook('afterAll', fn);
  (global as any).describe = describe;
  (global as any).fdescribe = describe.only(true);
  (global as any).xdescribe = describe.skip(true);
  (global as any).it = it;
  (global as any).fit = it.only(true);
  (global as any).xit = it.skip(true);

  return installTransform();
}
