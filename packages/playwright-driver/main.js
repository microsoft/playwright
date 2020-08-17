/**
 * Copyright Microsoft Corporation. All rights reserved.
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

const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');

(async () => {
  if (os.platform() === 'win32') {
    const checkDbPath = path.join(__dirname, 'node_modules', 'playwright', 'bin', 'PrintDeps.exe')

    const content = await util.promisify(fs.readFile)(checkDbPath);
    const output = path.join(os.tmpdir(), 'ms-playwright-print-deps.exe')
    await util.promisify(fs.writeFile)(output, content)

    process.env.PW_PRINT_DEPS_WINDOWS_EXECUTABLE = output
  }

  if (process.argv.includes('install')) {
    await require('../../lib/install/installer').installBrowsersWithProgressBar(path.dirname(process.argv[0]));
    return;
  }

  require('../../lib/rpc/server');
})();
