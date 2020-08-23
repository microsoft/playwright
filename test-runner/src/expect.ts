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

import { compare } from './golden';
import { RunnerConfig } from './runnerConfig';

declare global {
  const expect: typeof import('expect');
}

declare module 'expect/build/types' {
  interface Matchers<R> {
      toMatchImage(path: string, options?: { threshold?: number  }): R;
  }
}

global['expect'] = require('expect');

let testFile: string;

export function initializeImageMatcher(config: RunnerConfig) {
  function toMatchImage(received: Buffer, name: string, options?: { threshold?: number }) {
    const { pass, message } = compare(received, name, config, testFile, options);
    return { pass, message: () => message };
  };
  expect.extend({ toMatchImage });
}

export function setCurrentTestFile(file: string) {
  testFile = file;
}