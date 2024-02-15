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

import type { TestCaseSummary } from './types';

const labelsSymbol = Symbol('labels');

// Note: all labels start with "@"
export function testCaseLabels(test: TestCaseSummary): string[] {
  if (!(test as any)[labelsSymbol]) {
    const labels: string[] = [];
    if (test.botName)
      labels.push('@' + test.botName);
    labels.push(...test.tags);
    (test as any)[labelsSymbol] = labels;
  }
  return (test as any)[labelsSymbol];
}

// hash string to integer in range [0, 6] for color index, to get same color for same tag
export function hashStringToInt(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 8) - hash);
  return Math.abs(hash % 6);
}
