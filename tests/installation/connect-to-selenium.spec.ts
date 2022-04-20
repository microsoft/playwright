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
import path from 'path';
import { test } from './npmTest';

test('connect to selenium', async ({ npm, exec, tmpWorkspace }) => {
  await npm('i', '--foreground-scripts', 'playwright-core');
  await exec('node', ['./download-chromedriver.js', path.join(tmpWorkspace)]);
  await exec('npm', ['run', 'test', '--', '--reporter=list', 'selenium.spec'], { cwd: path.join(__dirname, '..', '..'), env: { ...process.env, PWTEST_CHROMEDRIVER: path.join(tmpWorkspace, 'chromedriver') } });
});
