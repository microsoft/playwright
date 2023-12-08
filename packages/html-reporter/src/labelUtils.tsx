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

export function escapeRegExp(string: string) {
  const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  const reHasRegExpChar = RegExp(reRegExpChar.source);

  return (string && reHasRegExpChar.test(string))
    ? string.replace(reRegExpChar, '\\$&')
    : (string || '');
}

export function testCaseLabels(test: TestCaseSummary): string[] {
  const tags = matchTags(test.path.join(' ') + ' ' + test.title).sort((a, b) => a.localeCompare(b));
  if (test.botName)
    tags.unshift(test.botName);
  return tags;
}

// match all tags in test title
function matchTags(title: string): string[] {
  return title.match(/@([\S]+)/g) || [];
}

// hash string to integer in range [0, 6] for color index, to get same color for same tag
export function hashStringToInt(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 8) - hash);
  return Math.abs(hash % 6);
}
