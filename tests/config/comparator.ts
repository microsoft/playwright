/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getComparator } from '../../packages/playwright-core/lib/server/utils/comparators';

const pngComparator = getComparator('image/png');
type ComparatorResult = { diff?: Buffer; errorMessage: string; } | null;
type ImageComparatorOptions = { threshold?: number, maxDiffPixels?: number, maxDiffPixelRatio?: number };

export function comparePNGs(actual: Buffer, expected: Buffer, options: ImageComparatorOptions = {}): ComparatorResult {
  // Strict threshold by default in our tests.
  return pngComparator(actual, expected, { comparator: 'ssim-cie94', threshold: 0, ...options });
}
