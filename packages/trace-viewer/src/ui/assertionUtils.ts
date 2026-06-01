/**
 * Copyright (c) Microsoft Corporation.
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

import type { ActionTraceEvent } from '@trace/trace';

export function isAssertionAction(action: ActionTraceEvent): boolean {
  if (action.class === 'Test' && action.method === 'expect')
    return true;
  if (action.class === 'Test' && action.method === 'test.step') {
    const title = action.title ?? '';
    return /^assert\b/i.test(title);
  }
  return false;
}

export function formatAssertionLabel(action: ActionTraceEvent): string {
  const title = action.title ?? '';
  if (action.method === 'expect') {
    const quoted = title.match(/^Expect "(.+)"$/);
    if (quoted) {
      const matcher = quoted[1];
      const expected = action.params?.expected;
      if (expected !== undefined && matcher.startsWith('to '))
        return `expected ${expected} ${matcher}`;
      return matcher;
    }
    return title.replace(/^Expect /, '');
  }
  return title.replace(/^assert /i, '');
}
