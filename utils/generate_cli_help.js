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

const fs = require('fs')
const path = require('path')

const { generateHelp, generateReadme, generateHelpJSON } = require('../packages/playwright/lib/mcp/terminal/helpGenerator.js');

if (process.argv[2] === '--readme') {
  console.log(generateReadme());
  process.exit(0);
}

if (process.argv[2] === '--print') {
  console.log(generateHelp());
  process.exit(0);
}

const fileName = path.resolve(__dirname, '../packages/playwright/lib/mcp/terminal/help.json');
console.log('Writing ', path.relative(process.cwd(), fileName));
fs.writeFileSync(fileName, JSON.stringify(generateHelpJSON(), null, 2));
