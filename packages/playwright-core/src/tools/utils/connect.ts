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

import type * as playwright from '../../..';
import type { BrowserDescriptor } from '../../serverRegistry';

export async function connectToBrowserAcrossVersions(descriptor: BrowserDescriptor): Promise<playwright.Browser> {
  const pw = require(descriptor.playwrightLib);
  const browserType = pw[descriptor.browser.browserName] as playwright.BrowserType;
  return await browserType.connect(descriptor.pipeName!);
}
