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

const Base = require('mocha/lib/reporters/base');
const constants = require('mocha/lib/runner').constants;
const colors = require('colors/safe');
const milliseconds = require('ms');
const { codeFrameColumns } = require('@babel/code-frame');
const path = require('path');
const fs = require('fs');
const os = require('os');
const terminalLink = require('terminal-link');
const StackUtils = require('stack-utils');
const stackUtils = new StackUtils();
class DotReporter extends Base {
  constructor(runner, options) {
    super(runner, options);

    process.on('SIGINT', async () => {
      this.epilogue();
      process.exit(130);
    });

    runner.on(constants.EVENT_TEST_PENDING, test => {
      process.stdout.write(colors.yellow('∘'))
    });

    runner.on(constants.EVENT_TEST_PASS, () => {
      process.stdout.write(colors.green('\u00B7'));
    });

    runner.on(constants.EVENT_TEST_FAIL, test => {
      if (test.duration >= test.timeout())
        process.stdout.write(colors.red('T'));
      else
        process.stdout.write(colors.red('F'));
    });

    runner.once(constants.EVENT_RUN_END, () => {
      process.stdout.write('\n');
      this.epilogue();
    });
  }

  epilogue() {
    console.log('');

    console.log(colors.green(`  ${this.stats.passes || 0} passing`) + colors.dim(` (${milliseconds(this.stats.duration)})`));  

    if (this.stats.pending)
      console.log(colors.yellow(`  ${this.stats.pending} skipped`));

    if (this.stats.failures) {  
      console.log(colors.red(`  ${this.stats.failures} failing`));
      console.log('');
      this.failures.forEach((failure, index) => {
        const relativePath = path.relative(process.cwd(), failure.file);
        const header = `  ${index +1}. ${terminalLink(relativePath, `file://${os.hostname()}${failure.file}`)} › ${failure.title}`;
        console.log(colors.bold(colors.red(header)));
        const stack = failure.err.stack;
        if (stack) {
          console.log('');
          const messageLocation = failure.err.stack.indexOf(failure.err.message);
          const preamble = failure.err.stack.substring(0, messageLocation + failure.err.message.length);
          console.log(indent(preamble, '    '));
          const position = positionInFile(stack, failure.file);
          if (position) {
            const source = fs.readFileSync(failure.file, 'utf8');
            console.log('');
            console.log(indent(codeFrameColumns(source, {
                start: position,
              },
              { highlightCode: true}
            ), '    '));
          }
          console.log('');
          console.log(indent(colors.dim(stack.substring(preamble.length + 1)), '    '));
        } else {
          console.log('');
          console.log(indent(String(failure.err), '    '));
        }
        console.log('');
      });
    }
  }
}

/**
 * @param {string} lines 
 * @param {string} tab 
 */
function indent(lines, tab) {
  return lines.replace(/^/gm, tab);
}

/**
 * @param {string} stack 
 * @param {string} file 
 * @return {{column: number, line: number}}
 */
function positionInFile(stack, file) {
  for (const line of stack.split('\n')) {
    const parsed = stackUtils.parseLine(line);
    if (!parsed)
      continue;
    if (path.resolve(process.cwd(), parsed.file) === file)
      return {column: parsed.column, line: parsed.line};
  }
  return null;
}

module.exports = DotReporter;
