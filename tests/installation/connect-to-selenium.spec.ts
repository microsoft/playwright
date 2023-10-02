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
import os from 'os';
import path from 'path';
import { test } from './npmTest';

test('connect to selenium', async ({ exec, tmpWorkspace }, testInfo) => {
  test.skip(os.platform() !== 'linux');

  await exec('npm i playwright-core');
  await exec(`node download-chromedriver.js ${tmpWorkspace}`);
  const seleniumPath = path.join(tmpWorkspace, 'selenium');
  await exec(`node download-selenium.js ${seleniumPath}`);
  await exec(`npm run test -- --reporter=list selenium.spec --output=${testInfo.outputPath('tmp-test-results')}`, {
    cwd: path.join(__dirname, '..', '..'),
    env: {
      PWTEST_CHROMEDRIVER: path.join(tmpWorkspace, 'chromedriver'),
      PWTEST_SELENIUM: seleniumPath,
    },
  });
});
