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

const { spawn } = require('child_process');

const commands = process.argv.slice(2);
if (!commands.length) {
  console.error('Usage: node utils/concurrently.js "<command>" ["<command>" ...]');
  process.exit(1);
}

for (let index = 0; index < commands.length; index++)
  run(commands[index], `[${index}]`);

function run(command, prefix) {
  const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  prefixLines(child.stdout, process.stdout, prefix);
  prefixLines(child.stderr, process.stderr, prefix);
  process.stdout.write(`${prefix} running "${command}"\n`);
  child.on('error', error => {
    process.exitCode = 1;
    process.stderr.write(`${prefix} failed to start: ${error.message}\n`);
  });
  child.on('close', code => {
    if (code)
      process.exitCode = 1;
    process.stdout.write(`${prefix} ${command} exited with code ${code}\n`);
  });
}

function prefixLines(stream, out, prefix) {
  let buffer = '';
  stream.on('data', chunk => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines)
      out.write(`${prefix} ${line}\n`);
  });
  stream.on('end', () => {
    if (buffer)
      out.write(`${prefix} ${buffer}\n`);
  });
}
