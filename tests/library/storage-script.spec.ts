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

import { test, expect } from '@playwright/test';
import { source } from '../../packages/playwright-core/src/generated/storageScriptSource';

function createScript(calls: string[]) {
  const module = {} as any;
  new Function('module', source)(module);
  const script = new (module.exports.StorageScript())('firefox');
  script._global = {
    navigator: { serviceWorker: { getRegistrations: async () => [] } },
    indexedDB: {
      databases: async () => { calls.push('indexedDB.databases'); return []; },
      deleteDatabase: () => calls.push('indexedDB.deleteDatabase'),
    },
    sessionStorage: { clear: () => calls.push('sessionStorage.clear') },
    localStorage: {
      clear: () => calls.push('localStorage.clear'),
      setItem: (name: string) => calls.push('localStorage.setItem:' + name),
    },
  };
  return script as { restore(state: any, clearStorage?: boolean): Promise<void> };
}

test('initial storage state restore only writes saved values', async () => {
  const calls: string[] = [];
  await createScript(calls).restore({ origin: 'https://example.com', localStorage: [{ name: 'key', value: 'value' }] }, false);
  expect(calls).toEqual(['localStorage.setItem:key']);
});

test('explicit storage state restore still clears storage first', async () => {
  const calls: string[] = [];
  await createScript(calls).restore({ origin: 'https://example.com', localStorage: [{ name: 'key', value: 'value' }] });
  expect(calls).toEqual(['indexedDB.databases', 'sessionStorage.clear', 'localStorage.clear', 'localStorage.setItem:key']);
});
