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
      const [nameOrConditionOrBody, maybeBody] = args;
      const body = typeof maybeBody === 'function' ? maybeBody : typeof nameOrConditionOrBody === 'function' ? nameOrConditionOrBody : null;
      if (!last || body) {
        const name = typeof maybeBody === 'function' ? nameOrConditionOrBody : '';
        // Looks like a body (either it or describe). Assume that last modifier is true.
        const newSpecs = { ...specs };
        if (last)
          newSpecs[last] = [true];
        return specCallback(newSpecs, name, body);
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

export function makeApi(suite: Suite, file: string, timeout: number) {
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
      test.pending = true;
    if (!only && specs.fail && specs.fail[0])
      test.pending = true;
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
      child.pending = true;
    if (!only && specs.fail && specs.fail[0])
      child.pending = true;
    suites.unshift(child);
    fn();
    suites.shift();
  });

  return {
    beforeEach: fn => suites[0]._addHook('beforeEach', fn),
    afterEach: fn => suites[0]._addHook('afterEach', fn),
    beforeAll: fn => suites[0]._addHook('beforeAll', fn),
    afterAll: fn => suites[0]._addHook('afterAll', fn),
    describe: describe,
    fdescribe: describe.only(true),
    xdescribe: describe.skip(true),
    it: it,
    fit: it.only(true),
    xit: it.skip(true),
  }
}

export function spec(suite: Suite, file: string, timeout: number): () => void {
  const api = makeApi(suite, file, timeout);
  for (const name in api)
    global[name] = api[name];
  return installTransform();
}
