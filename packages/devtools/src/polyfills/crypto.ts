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
// @ts-nocheck

// https://gist.github.com/alexdiliberto/39a4ad0453310d0a69ce#file-get_random_bytes-js
const randomBytes = (
  (typeof self !== 'undefined' && (self.crypto || self.msCrypto))
    ? function() { // Browsers
      const crypto = (self.crypto || self.msCrypto), QUOTA = 65536;
      return function(n) {
        const a = new Uint8Array(n);
        for (let i = 0; i < n; i += QUOTA)
          crypto.getRandomValues(a.subarray(i, i + Math.min(n - i, QUOTA)));

        return Buffer.from(a);
      };
    }
    : function() { // Node
      throw new Error();
    }
)();

// https://stackoverflow.com/a/7616484
export function createHash() {
  let hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export default {
  randomBytes,
  createHash,
};
