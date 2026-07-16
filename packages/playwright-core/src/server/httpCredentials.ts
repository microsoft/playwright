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

import type * as types from './types';

export function verifyHttpCredentials(httpCredentials: types.Credentials[] | undefined) {
  if (!httpCredentials)
    return;
  const origins = new Set<string>();
  for (const credentials of httpCredentials) {
    if (httpCredentials.length > 1 && !credentials.origin)
      throw new Error('httpCredentials.origin is required when providing multiple credentials');
    if (!credentials.origin)
      continue;
    let normalized: string;
    try {
      normalized = normalizeHttpOrigin(credentials.origin);
    } catch (e) {
      throw new Error(`httpCredentials.origin: ${String(e)}`);
    }
    if (origins.has(normalized))
      throw new Error(`httpCredentials: duplicate origin "${credentials.origin}"`);
    origins.add(normalized);
  }
}

export function normalizeHttpOrigin(origin: string): string {
  return new URL(origin).origin.toLowerCase();
}

export function findHttpCredentials(httpCredentials: types.Credentials[] | undefined, url: string | URL): types.Credentials | undefined {
  if (!httpCredentials?.length)
    return undefined;
  const requestOrigin = (typeof url === 'string' ? new URL(url) : url).origin.toLowerCase();
  const matching = httpCredentials.find(credentials => credentials.origin && normalizeHttpOrigin(credentials.origin) === requestOrigin);
  if (matching)
    return matching;
  if (httpCredentials.length === 1 && !httpCredentials[0].origin)
    return httpCredentials[0];
  return undefined;
}
