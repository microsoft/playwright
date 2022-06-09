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
import { test } from './npmTest';
import path from 'path';

test('@playwright/test should work', async ({ exec, nodeMajorVersion, tmpWorkspace }) => {
  await exec('npm i --foreground-scripts @playwright/test');
  await exec('npx playwright test -c .', { expectToExitWithError: true, message: 'should not be able to run tests without installing browsers' });

  await exec('npx playwright install');
  await exec('npx playwright test -c . --browser=all --reporter=list,json sample.spec.js', { env: {  PLAYWRIGHT_JSON_OUTPUT_NAME: 'report.json' } });
  await exec('node read-json-report.js', path.join(tmpWorkspace, 'report.json'));
  await exec('node sanity.js @playwright/test');
  if (nodeMajorVersion >= 14)
    await exec('node', 'esm-playwright-test.mjs');
});
