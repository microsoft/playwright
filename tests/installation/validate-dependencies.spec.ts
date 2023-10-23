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

test('validate dependencies', async ({ exec }) => {
  await exec('npm i playwright');
  await exec('npx playwright install chromium');

  await test.step('default (on)', async () => {
    const result1 = await exec('node validate-dependencies.js');
    expect(result1).toContain(`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`);
  });

  await test.step('disabled (off)', async () => {
    const result2 = await exec('node validate-dependencies-skip-executable-path.js');
    expect(result2).not.toContain(`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`);
  });
});
