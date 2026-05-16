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

export type RuntimeName = 'node' | 'bun';

export const MIN_BUN_VERSION = '1.3.14';

export function isBun(): boolean {
  return 'Bun' in globalThis;
}

export function runtimeName(): RuntimeName {
  return isBun() ? 'bun' : 'node';
}

export function requireMinimumBunVersion() {
  if (!isBun())
    return;
  const v = process.versions.bun;
  if (!v || !versionGte(v, MIN_BUN_VERSION))
    throw new Error(`Playwright requires bun >= ${MIN_BUN_VERSION}, got ${v ?? '<unknown>'}.`);
}

function versionGte(actual: string, minimum: string): boolean {
  const a = actual.split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < m.length; i++) {
    const lhs = a[i] ?? 0;
    if (lhs > m[i])
      return true;
    if (lhs < m[i])
      return false;
  }
  return true;
}
