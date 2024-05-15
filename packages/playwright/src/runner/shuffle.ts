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

/**
 * Shuffles the given array of items using the given seed.
 *
 * @param items The array of items to shuffle.
 * @param seed The seed to use for shuffling.
 */
export function shuffleWithSeed(items: any[], seed: string): void {
  const random = rng(cyrb32(seed));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Returns a random number generator seeded with the given seed.
 *
 * @param seed The seed for the random number generator.
 * @returns The random number generator.
 */
function rng(seed: number) {
  const m = 2 ** 35 - 31;
  const a = 185852;
  let s = seed % m;
  return function() {
    return (s = s * a % m) / m;
  };
}

/**
 * Return a 32-bit hash from a string.
 *
 * @param str The string to hash.
 * @returns The 32-bit hash.
 */
function cyrb32(str: string) {
  let h = 0x2323;
  for (let i = 0; i < str.length; i++) {
    h = h ^ str.charCodeAt(i);
    h = Math.imul(h, 2654435761);
  }
  return h >>> 0;
}
