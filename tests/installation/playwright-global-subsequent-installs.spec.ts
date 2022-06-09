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

test('subsequent installs works', async ({ exec }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/1651' });
  await exec('npm i --foreground-scripts playwright');
  // Note: the `npm install` would not actually crash, the error
  // is merely logged to the console. To reproduce the error, we should make
  // sure that script's install.js can be run subsequently without unhandled promise rejections.
  // Note: the flag `--unhandled-rejections=strict` will force node to terminate in case
  // of UnhandledPromiseRejection.
  await exec('node --unhandled-rejections=strict', path.join('node_modules', 'playwright', 'install.js'));
});
