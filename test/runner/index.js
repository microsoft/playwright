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

const fs = require('fs');
const path = require('path');
const program = require('commander');
const { Runner } = require('./runner');
const Mocha = require('mocha');
const constants = require('mocha/lib/runner').constants;
const { fixturesUI } = require('./fixturesUI');
const colors = require('colors/safe');

class NullReporter {}

program
  .version('Version ' + require('../../package.json').version)
  .option('--timeout <timeout>', 'timeout', 10000)
  .option('--reporter <reporter>', 'reporter to use', '')
  .option('--max-workers <maxWorkers>', 'max workers to use', Math.ceil(require('os').cpus().length / 2))
  .option('--retries <retries>', 'number of times to retry a failing test', 1)
  .action(async (command) => {
    // Collect files
    const files = [];
    collectFiles(path.join(process.cwd(), 'test'), command.args, files);
    const rootSuite = new Mocha.Suite('', new Mocha.Context(), true);

    console.log(`Transpiling ${files.length} test files`);
    // Build the test model, suite per file.
    for (const file of files) {
      const mocha = new Mocha({
        ui: fixturesUI.bind(null, true),
        retries: command.retries,
        timeout: command.timeout,
        reporter: NullReporter
      });
      mocha.addFile(file);
      mocha.suite.title = path.basename(file);
      mocha.suite.root = false;
      rootSuite.suites.push(mocha.suite);
      await new Promise(f => {
        const runner = mocha.run(f);
        runner.on(constants.EVENT_RUN_BEGIN, () => {
          process.stdout.write(colors.yellow('\u00B7'));
        });
      });
    }
    console.log();

    const runner = new Runner(rootSuite, {
      maxWorkers: command.maxWorkers,
      reporter: command.reporter,
      retries: command.retries,
      timeout: command.timeout,
    });
    await runner.run(files);
    await runner.stop();
  });

program.parse(process.argv);

function collectFiles(dir, filters, files) {
  for (const name of fs.readdirSync(dir)) {
    if (fs.lstatSync(path.join(dir, name)).isDirectory()) {
      collectFiles(path.join(dir, name), filters, files);
      continue;
    }
    if (!name.includes('spec'))
      continue;
    if (!filters.length) {
      files.push(path.join(dir, name));
      continue;
    }
    for (const filter of filters) {
      if (name.includes(filter)) {
        files.push(path.join(dir, name));
        break;
      }
    }
  }
}
