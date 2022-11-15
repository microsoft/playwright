/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { app } = require('electron');
const path = require('path');
const { chromiumSwitches } = require('../chromium/chromiumSwitches');

// Command line is like:
// [Electron, loader.js, --inspect=0, --remote-debugging-port=0, options.cwd, app.js, ...args]
const appPath = path.resolve(process.argv[4], process.argv[5]);
process.argv.splice(2, 4);
process.argv[1] = appPath;
// Now it is like
// [Electron, app.js, ...args]

for (const arg of chromiumSwitches) {
  const match = arg.match(/--([^=]*)=?(.*)/)!;
  app.commandLine.appendSwitch(match[1], match[2]);
  app.getAppPath = () => path.dirname(appPath);
}

(globalThis as any).__playwright_run = () => {
  require(appPath);
};
