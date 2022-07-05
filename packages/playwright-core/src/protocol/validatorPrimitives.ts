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
export type Validator = (arg: any, path: string, context: ValidatorContext) => any;
export type ValidatorContext = {
  tChannelImpl: (names: '*' | string[], arg: any, path: string, context: ValidatorContext) => any,
  binary: 'toBase64' | 'fromBase64' | 'buffer',
};
export const scheme: { [key: string]: Validator } = {};

export function findValidator(type: string, method: string, kind: 'Initializer' | 'Event' | 'Params' | 'Result'): Validator {
  const validator = maybeFindValidator(type, method, kind);
  if (!validator)
    throw new ValidationError(`Unknown scheme for ${kind}: ${type}.${method}`);
  return validator;
}
export function maybeFindValidator(type: string, method: string, kind: 'Initializer' | 'Event' | 'Params' | 'Result'): Validator | undefined {
  const schemeName = type + (kind === 'Initializer' ? '' : method[0].toUpperCase() + method.substring(1)) + kind;
  return scheme[schemeName];
}
export function createMetadataValidator(): Validator {
  return tOptional(scheme['Metadata']);
}

export const tNumber: Validator = (arg: any, path: string, context: ValidatorContext) => {
  if (arg instanceof Number)
    return arg.valueOf();
  if (typeof arg === 'number')
    return arg;
  throw new ValidationError(`${path}: expected number, got ${typeof arg}`);
};
export const tBoolean: Validator = (arg: any, path: string, context: ValidatorContext) => {
  if (arg instanceof Boolean)
    return arg.valueOf();
  if (typeof arg === 'boolean')
    return arg;
  throw new ValidationError(`${path}: expected boolean, got ${typeof arg}`);
};
export const tString: Validator = (arg: any, path: string, context: ValidatorContext) => {
  if (arg instanceof String)
    return arg.valueOf();
  if (typeof arg === 'string')
    return arg;
  throw new ValidationError(`${path}: expected string, got ${typeof arg}`);
};
export const tBinary: Validator = (arg: any, path: string, context: ValidatorContext) => {
  if (context.binary === 'fromBase64') {
    if (arg instanceof String)
      return Buffer.from(arg.valueOf(), 'base64');
    if (typeof arg === 'string')
      return Buffer.from(arg, 'base64');
    throw new ValidationError(`${path}: expected base64-encoded buffer, got ${typeof arg}`);
  }
  if (context.binary === 'toBase64') {
    if (!(arg instanceof Buffer))
      throw new ValidationError(`${path}: expected Buffer, got ${typeof arg}`);
    return (arg as Buffer).toString('base64');
  }
  if (context.binary === 'buffer') {
    if (!(arg instanceof Buffer))
      throw new ValidationError(`${path}: expected Buffer, got ${typeof arg}`);
    return arg;
  }
  throw new ValidationError(`Unsupported binary behavior "${context.binary}"`);
};
export const tUndefined: Validator = (arg: any, path: string, context: ValidatorContext) => {
  if (Object.is(arg, undefined))
    return arg;
  throw new ValidationError(`${path}: expected undefined, got ${typeof arg}`);
};
export const tAny: Validator = (arg: any, path: string, context: ValidatorContext) => {
  return arg;
};
export const tOptional = (v: Validator): Validator => {
  return (arg: any, path: string, context: ValidatorContext) => {
    if (Object.is(arg, undefined))
      return arg;
    return v(arg, path, context);
  };
};
export const tArray = (v: Validator): Validator => {
  return (arg: any, path: string, context: ValidatorContext) => {
    if (!Array.isArray(arg))
      throw new ValidationError(`${path}: expected array, got ${typeof arg}`);
    return arg.map((x, index) => v(x, path + '[' + index + ']', context));
  };
};
export const tObject = (s: { [key: string]: Validator }): Validator => {
  return (arg: any, path: string, context: ValidatorContext) => {
    if (Object.is(arg, null))
      throw new ValidationError(`${path}: expected object, got null`);
    if (typeof arg !== 'object')
      throw new ValidationError(`${path}: expected object, got ${typeof arg}`);
    const result: any = {};
    for (const [key, v] of Object.entries(s)) {
      const value = v(arg[key], path ? path + '.' + key : key, context);
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
  return (arg: any, path: string, context: ValidatorContext) => {
    if (!e.includes(arg))
      throw new ValidationError(`${path}: expected one of (${e.join('|')})`);
    return arg;
  };
};
export const tChannel = (names: '*' | string[]): Validator => {
  return (arg: any, path: string, context: ValidatorContext) => {
    return context.tChannelImpl(names, arg, path, context);
  };
};
export const tType = (name: string): Validator => {
  return (arg: any, path: string, context: ValidatorContext) => {
    const v = scheme[name];
    if (!v)
      throw new ValidationError(path + ': unknown type "' + name + '"');
    return v(arg, path, context);
  };
};
