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

test('android types', async ({ npm, npx, exec, envOverrides, nodeVersion }) => {
  await npm('i', '--foreground-scripts', '@playwright/test');

  const tryRunningTests = await npx('playwright', 'test', '-c', '.')
    .then(() => false)
    .catch(e => true);
  expect(tryRunningTests, 'should not be able to run tests without installing browsers').toBe(true);

  envOverrides['PLAYWRIGHT_BROWSERS_PATH'] = '0';
  await npx('playwright', 'install');
  envOverrides['PLAYWRIGHT_JSON_OUTPUT_NAME'] = 'report.json';
  await npx('playwright', 'test',
      '-c', '.',
      '--browser=all',
      '--reporter=list,json',
      'sample.spec.js'
  );

  await exec('node', ['./read-json-report.js', './report.json']);
  await exec('node', ['sanity.js', '@playwright/test']);

  if (nodeVersion >= 14)
    await exec('node', ['esm-playwright-test.mjs']);
});
