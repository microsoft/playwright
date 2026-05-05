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

// @ts-check

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const specDir = path.join(__dirname, '..', 'packages', 'protocol', 'spec');

function loadSpecFiles() {
  return fs.readdirSync(specDir).filter(f => f.endsWith('.yml')).sort();
}

function loadProtocol() {
  const files = loadSpecFiles();
  const protocol = {};
  for (const file of files) {
    const text = fs.readFileSync(path.join(specDir, file), 'utf-8');
    const doc = yaml.parse(text);
    if (!doc || typeof doc !== 'object')
      throw new Error(`packages/protocol/spec/${file} is empty or not a YAML map`);
    for (const [name, value] of Object.entries(doc)) {
      if (name in protocol)
        throw new Error(`Duplicate top-level definition "${name}" in packages/protocol/spec/${file}`);
      protocol[name] = value;
    }
  }
  return protocol;
}

function loadProtocolYaml() {
  const files = loadSpecFiles();
  const parts = [];
  for (const file of files) {
    let text = fs.readFileSync(path.join(specDir, file), 'utf-8');
    if (!text.endsWith('\n'))
      text += '\n';
    parts.push(text);
  }
  return parts.join('\n');
}

module.exports = { loadProtocol, loadProtocolYaml };

if (require.main === module) {
  process.stdout.write(loadProtocolYaml());
}
