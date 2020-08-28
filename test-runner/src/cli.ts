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

import program from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { run, RunnerConfig } from '.';
import PytestReporter from './reporters/pytest';
import DotReporter from './reporters/dot';
import ListReporter from './reporters/list';
import JSONReporter from './reporters/json';
import { Reporter } from './reporter';
import { Multiplexer } from './reporters/multiplexer';

export const reporters = {
  'dot': DotReporter,
  'list': ListReporter,
  'json': JSONReporter,
  'pytest': PytestReporter,
};

program
    .version('Version ' + /** @type {any} */ (require)('../package.json').version)
    .option('--forbid-only', 'Fail if exclusive test(s) encountered', false)
    .option('-g, --grep <grep>', 'Only run tests matching this string or regexp', '.*')
    .option('--global-timeout <timeout>', 'Specify maximum time this test suite can run (in milliseconds), default: 0 for unlimited', '0')
    .option('-j, --jobs <jobs>', 'Number of concurrent jobs for --parallel; use 1 to run in serial, default: (number of CPU cores / 2)', String(Math.ceil(require('os').cpus().length / 2)))
    .option('--reporter <reporter>', 'Specify reporter to use, comma-separated, can be "dot", "list", "json"', 'dot')
    .option('--repeat-each <repeat-each>', 'Specify how many times to run the tests', '1')
    .option('--retries <retries>', 'Specify retry count', '0')
    .option('--trial-run', 'Only collect the matching tests and report them as passing')
    .option('--quiet', 'Suppress stdio', false)
    .option('--debug', 'Run tests in-process for debugging', false)
    .option('--output <outputDir>', 'Folder for output artifacts, default: test-results', path.join(process.cwd(), 'test-results'))
    .option('--timeout <timeout>', 'Specify test timeout threshold (in milliseconds), default: 10000', '10000')
    .option('-u, --update-snapshots', 'Use this flag to re-record every snapshot that fails during this test run')
    .action(async command => {
      const testDir = path.resolve(process.cwd(), command.args[0]);
      const config: RunnerConfig = {
        debug: command.debug,
        forbidOnly: command.forbidOnly,
        quiet: command.quiet,
        grep: command.grep,
        jobs: parseInt(command.jobs, 10),
        outputDir: command.output,
        repeatEach: parseInt(command.repeatEach, 10),
        retries: parseInt(command.retries, 10),
        snapshotDir: path.join(testDir, '__snapshots__'),
        testDir,
        timeout: parseInt(command.timeout, 10),
        globalTimeout: parseInt(command.globalTimeout, 10),
        trialRun: command.trialRun,
        updateSnapshots: command.updateSnapshots
      };

      const reporterList = command.reporter.split(',');
      const reporterObjects: Reporter[] = reporterList.map(c => {
        if (reporters[c])
          return new reporters[c]();
        try {
          const p = path.resolve(process.cwd(), c);
          return new (require(p).default)();
        } catch (e) {
          console.error('Invalid reporter ' + c, e);
          process.exit(1);
        }
      });

      const files = collectFiles(testDir, '', command.args.slice(1));
      const result = await run(config, files, new Multiplexer(reporterObjects));
      if (result === 'forbid-only') {
        console.error('=====================================');
        console.error(' --forbid-only found a focused test.');
        console.error('=====================================');
        process.exit(1);
      }

      if (result === 'no-tests') {
        console.error('=================');
        console.error(' no tests found.');
        console.error('=================');
        process.exit(1);
      }

      process.exit(result === 'failed' ? 1 : 0);
    });

program.parse(process.argv);

function collectFiles(testDir: string, dir: string, filters: string[]): string[] {
  const fullDir = path.join(testDir, dir);
  if (fs.statSync(fullDir).isFile())
    return [fullDir];
  const files = [];
  for (const name of fs.readdirSync(fullDir)) {
    if (fs.lstatSync(path.join(fullDir, name)).isDirectory()) {
      files.push(...collectFiles(testDir, path.join(dir, name), filters));
      continue;
    }
    if (!name.endsWith('spec.ts'))
      continue;
    const relativeName = path.join(dir, name);
    const fullName = path.join(testDir, relativeName);
    if (!filters.length) {
      files.push(fullName);
      continue;
    }
    for (const filter of filters) {
      if (relativeName.includes(filter)) {
        files.push(fullName);
        break;
      }
    }
  }
  return files;
}
