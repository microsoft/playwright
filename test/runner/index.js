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
const { TestRunner, createTestSuite } = require('./testRunner');

class NullReporter {}

program
  .version('Version ' + require('../../package.json').version)
  .option('--forbid-only', 'Fail if exclusive test(s) encountered', false)
  .option('-g, --grep <grep>', 'Only run tests matching this string or regexp', '.*')
  .option('-j, --jobs <jobs>', 'Number of concurrent jobs for --parallel; use 1 to run in serial, default: (number of CPU cores / 2)', Math.ceil(require('os').cpus().length / 2))
  .option('--reporter <reporter>', 'Specify reporter to use', '')
  .option('--trial-run', 'Only collect the matching tests and report them as passing')
  .option('--quiet', 'Suppress stdio', false)
  .option('--debug', 'Run tests in-process for debugging', false)
  .option('--timeout <timeout>', 'Specify test timeout threshold (in milliseconds), default: 10000', 10000)
  .action(async (command) => {
    // Collect files
    const files = collectFiles(path.join(process.cwd(), command.args[0]), command.args.slice(1));
    const rootSuite = new createTestSuite();

    let total = 0;
    // Build the test model, suite per file.
    for (const file of files) {
      const testRunner = new TestRunner(file, {
        forbidOnly: command.forbidOnly || undefined,
        grep: command.grep,
        reporter: NullReporter,
        timeout: command.timeout,
        trialRun: true,
      });
      total += testRunner.grepTotal();
      rootSuite.addSuite(testRunner.suite);
      testRunner.suite.title = path.basename(file);
    }

    if (!total) {
      console.error('No tests found.');
      process.exit(1);
    }

    // Filter tests.
    if (rootSuite.hasOnly())
      rootSuite.filterOnly();
    if (!command.reporter) {
      console.log();
      total = Math.min(total, rootSuite.total()); // First accounts for grep, second for only.
      console.log(`Running ${total} tests using ${Math.min(command.jobs, total)} workers`);
    }

    // Trial run does not need many workers, use one.
    const jobs = (command.trialRun || command.debug) ? 1 : command.jobs;
    const runner = new Runner(rootSuite, {
      debug: command.debug,
      quiet: command.quiet,
      grep: command.grep,
      jobs,
      reporter: command.reporter,
      retries: command.retries,
      timeout: command.timeout,
      trialRun: command.trialRun,
    });
    await runner.run(files);
    await runner.stop();
    process.exit(runner.stats.failures ? 1 : 0);
  });

program.parse(process.argv);

function collectFiles(dir, filters) {
  if (fs.statSync(dir).isFile())
    return [dir];
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    if (fs.lstatSync(path.join(dir, name)).isDirectory()) {
      files.push(...collectFiles(path.join(dir, name), filters));
      continue;
    }
    if (!name.endsWith('spec.ts'))
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
  return files;
}
