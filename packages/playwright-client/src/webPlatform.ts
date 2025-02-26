/* eslint-disable no-console */
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

import { emptyPlatform } from '../../playwright-core/src/client/platform';

import type { Platform } from '../../playwright-core/src/client/platform';

export const webPlatform: Platform = {
  ...emptyPlatform,

  name: 'web',

  boxedStackPrefixes: () => [],

  calculateSha1: async (text: string) => {
    const bytes = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
  },

  createGuid: () => {
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  },

  isLogEnabled(name: 'api' | 'channel') {
    return true;
  },

  log(name: 'api' | 'channel', message: string | Error | object) {
    console.debug(name, message);
  },

  showInternalStackFrames: () => true,
};
