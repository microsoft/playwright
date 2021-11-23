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

export function deepEquals(a: any, b: any): boolean {
  if (a === b)
    return true;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor)
      return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; ++i) {
        if (!deepEquals(a[i], b[i]))
          return false;
      }
      return true;
    }

    if (a instanceof RegExp)
      return a.source === b.source && a.flags === b.flags;
    // This covers Date.
    if (a.valueOf !== Object.prototype.valueOf)
      return a.valueOf() === b.valueOf();
    // This covers custom objects.
    if (a.toString !== Object.prototype.toString)
      return a.toString() === b.toString();

    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length)
      return false;

    for (let i = 0; i < keys.length; ++i) {
      if (!b.hasOwnProperty(keys[i]))
        return false;
    }

    for (const key of keys) {
      if (!deepEquals(a[key], b[key]))
        return false;
    }
    return true;
  }

  if (typeof a === 'number' && typeof b === 'number')
    return isNaN(a) && isNaN(b);

  return false;
}
