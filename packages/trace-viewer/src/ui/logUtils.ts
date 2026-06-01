/**
 * Copyright (c) 2026 Roo.
 * Based on Playwright trace-viewer (Copyright (c) Microsoft Corporation).
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

export function isLogAction(action: ActionTraceEvent): boolean {
  if (action.class === 'Test' && action.method === 'test.step') {
    const title = action.title ?? '';
    return /^log\b/i.test(title);
  }
  return false;
}

export function formatLogLabel(action: ActionTraceEvent): string {
  return (action.title ?? '').replace(/^log /i, '');
}
