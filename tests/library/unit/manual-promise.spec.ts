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
import { iso } from '../../../packages/playwright-core/lib/coreBundle';

test('MP-001 should format scope race stacks only on close', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44334' } }, async () => {
  const prepareStackTrace = Error.prepareStackTrace;
  let stackFormats = 0;
  Error.prepareStackTrace = (error, frames) => {
    if (frames.some(frame => frame.getFunctionName() === '_race'))
      ++stackFormats;
    return prepareStackTrace(error, frames);
  };
  try {
    const scope = new iso.LongStandingScope();
    const value = await scope.race(Promise.resolve('done'));
    expect(value).toBe('done');
    expect(stackFormats).toBe(0);

    function startRace() {
      return scope.race(new iso.ManualPromise()).catch(error => error);
    }
    const result = startRace();
    expect(stackFormats).toBe(0);
    scope.close(new TypeError('scope closed'));
    const error = await result;
    expect(stackFormats).toBe(1);
    expect(error.name).toBe('TypeError');
    expect(error.message).toBe('scope closed');
    expect(error.stack).toContain('startRace');
  } finally {
    Error.prepareStackTrace = prepareStackTrace;
  }
});
