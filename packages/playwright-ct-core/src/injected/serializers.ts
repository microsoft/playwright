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
  return transformObject(value, (v: any) => {
    if (typeof v === 'function') {
      const ordinal = callbacks.length;
      callbacks.push(v as Function);
      const result: FunctionRef = {
        __pw_type: 'function',
        ordinal,
      };
      return { result };
    }
  });
}

export async function unwrapObject(value: any): Promise<any> {
  return transformObjectAsync(value, async (v: any) => {
    if (isFunctionRef(v)) {
      const result = (...args: any[]) => {
        window.__ctDispatchFunction(v.ordinal, args);
      };
      return { result };
    }
    if (isImportRef(v))
      return { result: await window.__pwRegistry.resolveImportRef(v) };
  });
}

export function transformObject(value: any, mapping: (v: any) => { result: any } | undefined): any {
  const result = mapping(value);
  if (result)
    return result.result;
  if (value === null || typeof value !== 'object')
    return value;
  if (value instanceof Date || value instanceof RegExp || value instanceof URL)
    return value;
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value)
      result.push(transformObject(item, mapping));
    return result;
  }
  if (value?.__pw_type === 'jsx' && typeof value.type === 'function') {
    throw new Error([
      `Component "${value.type.name}" cannot be mounted.`,
      `Most likely, this component is defined in the test file. Create a test story instead.`,
      `For more information, see https://playwright.dev/docs/test-components#test-stories.`,
    ].join('\n'));
  }
  const result2: any = {};
  for (const [key, prop] of Object.entries(value))
    result2[key] = transformObject(prop, mapping);
  return result2;
}

export async function transformObjectAsync(value: any, mapping: (v: any) => Promise<{ result: any } | undefined>): Promise<any> {
  const result = await mapping(value);
  if (result)
    return result.result;
  if (value === null || typeof value !== 'object')
    return value;
  if (value instanceof Date || value instanceof RegExp || value instanceof URL)
    return value;
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value)
      result.push(await transformObjectAsync(item, mapping));
    return result;
  }
  const result2: any = {};
  for (const [key, prop] of Object.entries(value))
    result2[key] = await transformObjectAsync(prop, mapping);
  return result2;
}
