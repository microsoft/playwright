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

import { chromium, firefox, webkit, selectors, devices, errors, request, test, expect } from '@playwright/test';
import * as playwright from '@playwright/test';
import defaultExport from '@playwright/test';
import testESM from './esm.mjs';

if (defaultExport !== test) {
  console.error('default export is not test.');
  process.exit(1);
}

if (typeof test !== 'function') {
  console.error('test is not a function');
  process.exit(1);
}

if (typeof expect !== 'function') {
  console.error('expect is not a function');
  process.exit(1);
}
expect(1).toBe(1);

testESM({ chromium, firefox, webkit, selectors, devices, errors, request, playwright }, [chromium, firefox, webkit]);
