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

const path = require('path');
const fs = require('fs');
const PROJECT_DIR = path.join(__dirname, '..', '..');
const md = require('../markdown');

const allowList = [
  'forbidOnly',
  'fullyParallel',
  'globalSetup',
  'globalTeardown',
  'globalTimeout',
  'grep',
  'grepInvert',
  'maxFailures',
  'metadata',
  'version',
  'preserveOutput',
  'projects',
  'reporter',
  'reportSlowTests',
  'rootDir',
  'quiet',
  'shard',
  'updateSnapshots',
  'workers',
  'webServer',
  'configFile',
];
const allowedNames = new Set(allowList);

const content = fs.readFileSync(path.join(PROJECT_DIR, 'docs/src/test-api/class-testconfig.md')).toString();

function propertyNameFromSection(section) {
  section = section.split('\n')[0];
  const match = /\.(\w+)/.exec(section);
  if (!match)
    return null;
  return match[1];
}

let sections = content.split('\n## ');
sections = sections.filter(section => {
  section = section.split('\n')[0];
  const name = propertyNameFromSection(section);
  if (!name)
    return true;
  return allowedNames.has(name);
});

// Change class name to FullConfig.
sections = sections.map(section => {
  const lines = section.split('\n');
  lines[0] = lines[0].replace('TestConfig', 'FullConfig');
  return lines.join('\n');
});

// Replace description.
sections = sections.map(section => {
  const parts = section.split('\n\n');
  section = parts[0];
  const name = propertyNameFromSection(section);
  console.log(name)
  if (!name)
    return `${section}\n`;
  return `${section}\n\nSee [\`property: TestConfig.${name}\`].\n`;
});

const fullconfig = sections.join('\n## ');
fs.writeFileSync(path.join(PROJECT_DIR, 'docs/src/test-api/class-fullconfig.md'), fullconfig);