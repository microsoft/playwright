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

import { isImportRef } from './importRegistry';

type FunctionRef = {
  __pw_type: 'function';
  ordinal: number;
};

function isFunctionRef(value: any): value is FunctionRef {
  return value && typeof value === 'object' && value.__pw_type === 'function';
}

export function wrapObject(value: any, callbacks: Function[]): any {
  if (typeof value === 'function') {
    const ordinal = callbacks.length;
    callbacks.push(value as Function);
    const result: FunctionRef = {
      __pw_type: 'function',
      ordinal,
    };
    return result;
  }
  if (value === null || typeof value !== 'object')
    return value;
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value)
      result.push(wrapObject(item, callbacks));
    return result;
  }
  const result: any = {};
  for (const [key, prop] of Object.entries(value))
    result[key] = wrapObject(prop, callbacks);
  return result;
}

export async function unwrapObject(value: any): Promise<any> {
  if (value === null || typeof value !== 'object')
    return value;
  if (isFunctionRef(value)) {
    return (...args: any[]) => {
      window.__ctDispatchFunction(value.ordinal, args);
    };
  }
  if (isImportRef(value))
    return window.__pwRegistry.resolveImportRef(value);

  if (Array.isArray(value)) {
    const result = [];
    for (const item of value)
      result.push(await unwrapObject(item));
    return result;
  }
  const result: any = {};
  for (const [key, prop] of Object.entries(value))
    result[key] = await unwrapObject(prop);
  return result;
}
