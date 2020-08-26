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

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

(async () => {
  if (process.argv.length === 2 || process.argv.some(arg => arg.includes('--help'))) {
    console.log(`Usage:
      './driver --print-api' - Prints the Playwright API to the stdout
      './driver --print-readme'    - Prints the upstream Playwright README
      './driver --install'   - Downloads the Playwright browsers
      './driver --run'       - Executes the Playwright RPC server
    `);
    return;
  }
  // Playwright needs to launch the PrintDeps.exe which is embedded into the NPM package.
  // Since it's packed with PKG, we have to move it out and set the new path as an environment
  // variable so Playwright can use it.
  if (os.platform() === 'win32') {
    const printDepsPath = path.join(__dirname, '..', '..', 'bin', 'PrintDeps.exe');

    const printDepsFile = await readFileAsync(printDepsPath);
    const pwPrintDepsPath = path.join(os.tmpdir(), 'ms-playwright-print-deps.exe');
    await writeFileAsync(pwPrintDepsPath, printDepsFile);

    process.env.PW_PRINT_DEPS_WINDOWS_EXECUTABLE = pwPrintDepsPath;
  }

  if (process.argv[2] === '--print-api') {
    console.log((await readFileAsync(path.join(__dirname, 'api.json'))).toString());
    return;
  }

  if (process.argv[2] === '--print-readme') {
    console.log((await readFileAsync(path.join(__dirname, '..', '..', 'README.md'))).toString());
    return;
  }

  if (process.argv[2] === '--install') {
    // Place the browsers.json file into the current working directory.
    const browsersJSON = await readFileAsync(path.join(__dirname, '..', '..', 'browsers.json'));
    const driverDir = path.dirname(process.argv[0]);
    await writeFileAsync(path.join(driverDir, 'browsers.json'), browsersJSON);

    await require('../../lib/install/installer').installBrowsersWithProgressBar(driverDir);
    return;
  }

  if (process.argv[2] === '--run') {
    require('../../lib/server');
  }
})();
