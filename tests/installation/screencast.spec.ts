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

test('screencast works', async ({ exec }) => {
  const packages = ['playwright', 'playwright-chromium', 'playwright-firefox', 'playwright-webkit'];
  await exec('npm i --foreground-scripts', ...packages);
  for (const pkg of packages)
    await test.step(pkg, () => exec('node screencast.js', pkg));
});
