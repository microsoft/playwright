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

import expectLibrary from '../third_party/index';
export const expect = expectLibrary;
export * as mock from 'jest-mock';
import * as am from '../third_party/asymmetricMatchers';
import * as mu from 'jest-matcher-utils';

export const asymmetricMatchers = {
  any: am.any,
  anything: am.anything,
  arrayContaining: am.arrayContaining,
  arrayNotContaining: am.arrayNotContaining,
  closeTo: am.closeTo,
  notCloseTo: am.notCloseTo,
  objectContaining: am.objectContaining,
  objectNotContaining: am.objectNotContaining,
  stringContaining: am.stringContaining,
  stringMatching: am.stringMatching,
  stringNotContaining: am.stringNotContaining,
  stringNotMatching: am.stringNotMatching,
};

export const matcherUtils = {
  stringify: mu.stringify,
};

export {
  INVERTED_COLOR,
  RECEIVED_COLOR,
  printReceived,
} from 'jest-matcher-utils';
