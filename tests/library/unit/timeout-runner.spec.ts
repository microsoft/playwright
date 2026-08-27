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
import { raceAgainstDeadline } from '../../../packages/isomorphic/timeoutRunner';
import { monotonicTime } from '../../../packages/isomorphic/time';

test('raceAgainstDeadline should not emit TimeoutNegativeWarning for a passed deadline', async () => {
  const warnings: string[] = [];
  const onWarning = (w: Error) => warnings.push(w.name);
  process.on('warning', onWarning);
  try {
    const result = await raceAgainstDeadline(() => new Promise<void>(() => {}), monotonicTime() - 1);
    await new Promise(f => setImmediate(f));
    expect(result.timedOut).toBe(true);
    expect(warnings).not.toContain('TimeoutNegativeWarning');
  } finally {
    process.off('warning', onWarning);
  }
});
