#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

// @ts-check

const fs = require('fs');
const path = require('path');
const pkgJSON =require('../../packages/playwright-crx/package.json');

const ROOT = path.join(__dirname, '..', '..');

const crxDir = path.join(ROOT, 'packages', 'playwright-crx');
const pkgExports = Object.values(pkgJSON.exports["."]).filter(f => f.endsWith('js'));

if (pkgExports.length === 0) {
  console.error(`Could not find .js/.mjs exports at CRX package.json`);
  process.exit(1);
}

for (const pkgExport of [...new Set(pkgExports)]) {
  const file = path.resolve(crxDir, pkgExport);
  const relativeFile = path.relative(ROOT, file).split(path.sep).join(path.posix.sep);
  process.stdout.write(`Checking ${relativeFile}...`);
  const lib = fs.readFileSync(file, 'utf-8');

  /** @type {string[]} */
  // @ts-ignore
  const problems = lib
      .match(/__PW_CRX_error_([\w\.]+)__/g)
      ?.map(m => /__PW_CRX_error_([\w\.]+)__/.exec(m)?.[1])
      .filter(Boolean) ?? [];

  if (problems.length > 0) {
    process.stdout.write(` NOK\n`);
    process.stderr.write([
      `Found denied libraries in ${relativeFile}:`,
      ...problems.map(prob => `  ${prob}`),
      `` // newline
    ].join(`\n`));
    process.exit(1);
  } else {
    process.stdout.write(` OK\n`);
  }
}

