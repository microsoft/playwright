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

const playwright = require('playwright');
const path = require('path');

(async () => {
  const application = await playwright._electron.launch({
    args: [path.join(__dirname, 'electron-app.js')],
  });
  const appPath = await application.evaluate(async ({ app }) => app.getAppPath());
  await application.close();
  if (appPath !== __dirname)
    throw new Error(`Malformed app path: got "${appPath}", expected "${__dirname}"`);
  console.log(`playwright._electron SUCCESS`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
