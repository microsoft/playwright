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

import GoldenUtils from './GoldenUtils';

declare global {
  const expect: typeof import('expect');
}

declare module 'expect/build/types' {
  interface Matchers<R> {
      toMatchImage(path: string, options?: { threshold?: number  }): R;
  }
}

global['expect'] = require('expect');

let relativeTestFile: string;

export function initializeImageMatcher(options) {
  function toMatchImage(received, name, config) {
    const { pass, message } = GoldenUtils.compare(received, name, { ...options, relativeTestFile, config });
    return { pass, message: () => message };
  };
  expect.extend({ toMatchImage });
}

export function setCurrentTestFile(testFile: string) {
  relativeTestFile = testFile;
}