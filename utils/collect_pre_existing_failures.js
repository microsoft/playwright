#!/usr/bin/env node
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

function collect(dir) {
  const keys = new Set();
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return keys;
  }
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const key of collect(entryPath))
        keys.add(key);
    } else if (entry.name.endsWith('.json')) {
      try {
        for (const key of JSON.parse(fs.readFileSync(entryPath, 'utf8')))
          keys.add(key);
      } catch {
      }
    }
  }
  return keys;
}

function main() {
  const [, , inputDir, outputFile] = process.argv;
  if (!inputDir || !outputFile) {
    console.error('Usage: collect_pre_existing_failures.js <input-dir> <output-file>');
    process.exit(1);
  }
  const keys = collect(inputDir);
  fs.writeFileSync(outputFile, JSON.stringify([...keys]));
  console.log(`Collected ${keys.size} pre-existing failure key(s).`);
}

module.exports = { collect };

if (require.main === module)
  main();
