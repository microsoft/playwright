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

import { mergeTests } from '@playwright/test';
import { test } from '@playwright/test';
import type { CommonFixtures, CommonWorkerFixtures } from './commonFixtures';
import { commonFixtures } from './commonFixtures';
import type { ServerFixtures, ServerWorkerOptions } from './serverFixtures';
import { serverFixtures } from './serverFixtures';
import { platformTest } from './platformFixtures';
import { testModeTest } from './testModeFixtures';

export const base = test;

export const baseTest = mergeTests(base, platformTest, testModeTest)
    .extend<CommonFixtures, CommonWorkerFixtures>(commonFixtures)
    .extend<ServerFixtures, ServerWorkerOptions>(serverFixtures);

export function step<This extends Object, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Promise<Return>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>
) {
  function replacementMethod(this: This, ...args: Args): Promise<Return> {
    const name = this.constructor.name + '.' + (context.name as string) + '(' + args.map(a => JSON.stringify(a)).join(',') + ')';
    return test.step(name, async () => {
      return await target.call(this, ...args);
    });
  }
  return replacementMethod;
}

declare global {
  interface Window {
    builtinSetTimeout: WindowOrWorkerGlobalScope['setTimeout'],
    builtinClearTimeout: WindowOrWorkerGlobalScope['setTimeout'],
    builtinSetInterval: WindowOrWorkerGlobalScope['setInterval'],
    builtinClearInterval: WindowOrWorkerGlobalScope['clearInterval'],
    builtinRequestAnimationFrame: AnimationFrameProvider['requestAnimationFrame'],
    builtinCancelAnimationFrame: AnimationFrameProvider['cancelAnimationFrame'],
    builtinPerformance: WindowOrWorkerGlobalScope['performance'],
    builtinDate: typeof Date,
  }
}
