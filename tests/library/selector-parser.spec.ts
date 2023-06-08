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

import { playwrightTest as it, expect } from '../config/browserTest';
import { parseSelector } from '../../packages/playwright-core/lib/utils/isomorphic/selectorParser';

function parse(selector: string) {
  return parseSelector(selector).parts.map(({ name, source }) => ({ name, source }));
}

it('should parse selector', async () => {
  expect(parse(`:has-text=/Playwright$/`)).toEqual([{ name: ':has-text', source: '/Playwright$/' }]);
  expect(parse(`:has-text=">> breaks Playwright"`)).toEqual([{ name: ':has-text', source: '">> breaks Playwright"' }]);
  // #23540
  expect(parse(`:has-text=/>> breaks Playwright$/`)).toEqual([{ name: ':has-text', source: '/>> breaks Playwright$/' }]);
});
