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

export { isString } from  './stringUtils';

export function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}

export function isObject(obj: any): obj is NonNullable<object> {
  return typeof obj === 'object' && obj !== null;
}

export function isError(obj: any): obj is Error {
  return obj instanceof Error || (obj && Object.getPrototypeOf(obj)?.name === 'Error');
}
