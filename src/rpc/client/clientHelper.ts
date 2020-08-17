/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { isUnderTest as commonIsUnderTest } from '../../helper';
import * as types from './types';

const deprecatedHits = new Set();
export function deprecate(methodName: string, message: string) {
  if (deprecatedHits.has(methodName))
    return;
  deprecatedHits.add(methodName);
  console.warn(message);
}

export function isUnderTest() {
  return commonIsUnderTest();
}

export function envObjectToArray(env: types.Env): { name: string, value: string }[] {
  const result: { name: string, value: string }[] = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined))
      result.push({ name, value: String(env[name]) });
  }
  return result;
}
