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

const builtinReporters = require('mocha/lib/reporters');
const fs = require('fs');
const path = require('path');
const program = require('commander');
const { Runner } = require('./runner');
const DotRunner = require('./dotReporter');


program
  .version('Version ' + require('../../package.json').version)
  .option('--reporter <reporter>', 'reporter to use', '')
  .option('--max-workers <maxWorkers>', 'reporter to use', '')
  .option('--no-mocha', 'no mocha')
  .action(async (command, args) => {
    const testDir = path.join(process.cwd(), 'test');
    const files = [];
    for (const name of fs.readdirSync(testDir)) {
      if (!name.includes('.spec.'))
        continue;
      if (!command.args.length) {
        files.push(path.join(testDir, name));
        continue;
      }
      for (const filter of command.args) {
        if (name.includes(filter)) {
          files.push(path.join(testDir, name));
          break;
        }
      }
    }

    const runner = new Runner({
      reporter: command.reporter ? builtinReporters[command.reporter] : DotRunner,
      maxWorkers: command.maxWorkers || Math.ceil(require('os').cpus().length / 2),
      noMocha: !command.mocha,
    });
    await runner.run(files);
    await runner.stop();
  });

program.parse(process.argv);
