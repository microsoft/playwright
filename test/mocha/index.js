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
const { fixturesUI } = require('./fixturesUI');

class NullReporter {}

program
  .version('Version ' + require('../../package.json').version)
  .option('--timeout <timeout>', 'timeout', 10000)
  .option('--reporter <reporter>', 'reporter to use', '')
  .option('--max-workers <maxWorkers>', 'max workers to use', Math.ceil(require('os').cpus().length / 2))
  .option('--retries <retries>', 'number of times to retry a failing test', 1)
  .action(async (command) => {
    // Collect files
    const files = collectFiles(command.args);
    const rootSuite = new Mocha.Suite('', new Mocha.Context(), true);

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
      await new Promise(f => mocha.run(f));
    }

    if (rootSuite.hasOnly())
      rootSuite.filterOnly();

    console.log(`Running ${rootSuite.total()} tests`);
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

function collectFiles(args) {
  const testDir = path.join(process.cwd(), 'test');
  const files = [];
  for (const name of fs.readdirSync(testDir)) {
    if (!name.includes('.spec.'))
      continue;
    if (!args.length) {
      files.push(path.join(testDir, name));
      continue;
    }
    for (const filter of args) {
      if (name.includes(filter)) {
        files.push(path.join(testDir, name));
        break;
      }
    }
  }
  return files;
}
