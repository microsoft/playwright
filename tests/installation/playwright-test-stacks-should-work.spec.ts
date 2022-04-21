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

test('@playwright/test stacks should work', async ({ npm, npx, exec, envOverrides, nodeVersion }) => {
  await npm('i', '--foreground-scripts', '@playwright/test');

  envOverrides['PLAYWRIGHT_BROWSERS_PATH'] = '0';
  await npx('playwright', 'install', 'chromium');

  envOverrides['DEBUG'] = 'pw:api';
  const output = await npx('playwright', 'test', '-c', '.', 'failing.spec.js').then(() => '').catch(execOutput => execOutput.combined());

  expect(output).toContain('expect.toHaveText started');
  expect(output).toContain('failing.spec.js:5:38');
});
