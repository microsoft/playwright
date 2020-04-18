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

import { Page } from './page';
import { Log } from './logger';

const hintsLog: Log = {
  name: 'hint',
  severity: 'warning'
};

let waitForTimeWasUsedReported = false;
export function waitForTimeWasUsed(page: Page) {
  if (waitForTimeWasUsedReported)
    return;
  waitForTimeWasUsedReported = true;
  page._log(hintsLog, `WARNING: page.waitFor(timeout) should only be used for debugging.
It is likely that the tests using timer in production are going to be flaky.
Use signals such as network events, selectors becoming visible, etc. instead.`);
}
