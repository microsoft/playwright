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

import { browserTest as test, expect } from '../config/browserTest';

test.skip(({ browserName }) => browserName === 'webkit', 'WebKit does not implement WebMCP');
test.skip(({ isBidi }) => isBidi, 'WebMCP is not implemented over BiDi');

test('should throw when the browser was launched without WebMCP', async ({ page, browserName }) => {
  const error = await page.webmcp.enable().catch(e => e);
  expect(error.message).toContain('WebMCP is not enabled.');
  expect(error.message).toContain(browserName === 'firefox' ? 'dom.modelcontext.enabled' : '--enable-features=WebMCP');
});
