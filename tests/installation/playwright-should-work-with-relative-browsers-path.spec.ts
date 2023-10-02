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
import fs from 'fs';
import path from 'path';

test('playwright should work with relative home path', async ({ exec, tmpWorkspace }) => {
  await fs.promises.mkdir(path.join(tmpWorkspace, 'foo'));
  // Make sure that browsers path is resolved relative to the `npm install` call location.
  await exec('npm i playwright', { cwd: path.join(tmpWorkspace, 'foo'), env: { PLAYWRIGHT_BROWSERS_PATH: path.join('..', 'relative') } });
  await exec('npx playwright install', { cwd: path.join(tmpWorkspace, 'foo'), env: { PLAYWRIGHT_BROWSERS_PATH: path.join('..', 'relative') } });
  await exec('node sanity.js playwright chromium firefox webkit', { env: { PLAYWRIGHT_BROWSERS_PATH: path.join('.', 'relative') } });
});
