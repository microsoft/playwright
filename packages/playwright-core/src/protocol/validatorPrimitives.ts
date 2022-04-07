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

import { isUnderTest } from '../utils';

export class ValidationError extends Error {}
export type Validator = (arg: any, path: string) => any;

export const tNumber: Validator = (arg: any, path: string) => {
  if (arg instanceof Number)
    return arg.valueOf();
  if (typeof arg === 'number')
    return arg;
  throw new ValidationError(`${path}: expected number, got ${typeof arg}`);
};
export const tBoolean: Validator = (arg: any, path: string) => {
  if (arg instanceof Boolean)
    return arg.valueOf();
  if (typeof arg === 'boolean')
    return arg;
  throw new ValidationError(`${path}: expected boolean, got ${typeof arg}`);
};
export const tString: Validator = (arg: any, path: string) => {
  if (arg instanceof String)
    return arg.valueOf();
  if (typeof arg === 'string')
    return arg;
  throw new ValidationError(`${path}: expected string, got ${typeof arg}`);
};
export const tBinary: Validator = (arg: any, path: string) => {
  if (arg instanceof String)
    return arg.valueOf();
  if (typeof arg === 'string')
    return arg;
  throw new ValidationError(`${path}: expected base64-encoded buffer, got ${typeof arg}`);
};
export const tUndefined: Validator = (arg: any, path: string) => {
  if (Object.is(arg, undefined))
    return arg;
  throw new ValidationError(`${path}: expected undefined, got ${typeof arg}`);
};
export const tAny: Validator = (arg: any, path: string) => {
  return arg;
};
export const tOptional = (v: Validator): Validator => {
  return (arg: any, path: string) => {
    if (Object.is(arg, undefined))
      return arg;
    return v(arg, path);
  };
};
export const tArray = (v: Validator): Validator => {
  return (arg: any, path: string) => {
    if (!Array.isArray(arg))
      throw new ValidationError(`${path}: expected array, got ${typeof arg}`);
    return arg.map((x, index) => v(x, path + '[' + index + ']'));
  };
};
export const tObject = (s: { [key: string]: Validator }): Validator => {
  return (arg: any, path: string) => {
    if (Object.is(arg, null))
      throw new ValidationError(`${path}: expected object, got null`);
    if (typeof arg !== 'object')
      throw new ValidationError(`${path}: expected object, got ${typeof arg}`);
    const result: any = {};
    for (const [key, v] of Object.entries(s)) {
      const value = v(arg[key], path ? path + '.' + key : key);
      if (!Object.is(value, undefined))
        result[key] = value;
    }
    if (isUnderTest()) {
      for (const [key, value] of Object.entries(arg)) {
        if (key.startsWith('__testHook'))
          result[key] = value;
      }
    }
    return result;
  };
};
export const tEnum = (e: string[]): Validator => {
  return (arg: any, path: string) => {
    if (!e.includes(arg))
      throw new ValidationError(`${path}: expected one of (${e.join('|')})`);
    return arg;
  };
};
