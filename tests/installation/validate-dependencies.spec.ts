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
import { test, expect } from './npmTest';

test.describe('validate dependencies', () => {
  test('default (on)', async ({ exec }) => {
    await exec('npm i --foreground-scripts playwright');
    const result = await exec('node validate-dependencies.js');
    expect(result).toContain(`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`);
  });

  test('disabled (off)',  async ({ exec }) => {
    await exec('npm i --foreground-scripts playwright');
    const result = await exec('node validate-dependencies-skip-executable-path.js');
    expect(result).not.toContain(`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`);
  });
});
