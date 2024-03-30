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

function generateFullConfigClass(fromClassName, toClassName, allowList) {
  const allowedNames = new Set(allowList);

  const content = fs.readFileSync(path.join(PROJECT_DIR, `docs/src/test-api/class-${fromClassName.toLowerCase()}.md`)).toString();
  let sections = content.split('\n## ');
  sections = filterAllowedSections(sections, allowedNames);
  if (allowedNames.size)
    console.log(`Undocumented properties for ${fromClassName}:\n  ${[...allowedNames].join('\n  ')}`);
  sections = changeClassName(sections, fromClassName, toClassName);
  sections = replacePropertyDescriptions(sections, fromClassName);
  const fullconfig = sections.join('\n## ');
  fs.writeFileSync(path.join(PROJECT_DIR, `docs/src/test-api/class-${toClassName.toLowerCase()}.md`), fullconfig);
}

function propertyNameFromSection(section) {
  section = section.split('\n')[0];
  const match = /\.(\w+)/.exec(section);
  if (!match)
    return null;
  return match[1];
}

function filterAllowedSections(sections, allowedNames) {
  return sections.filter(section => {
    section = section.split('\n')[0];
    const name = propertyNameFromSection(section);
    if (!name)
      return true;
    return allowedNames.delete(name);
  });
}

function changeClassName(sections, from, to) {
  return sections.map(section => {
    const lines = section.split('\n');
    lines[0] = lines[0].replace(from, to);
    return lines.join('\n');
  });
}

function replacePropertyDescriptions(sections, configClassName) {
  return sections.map(section => {
    const parts = section.split('\n\n');
    section = parts[0];
    const name = propertyNameFromSection(section);
    if (!name)
      return `${section}\n`;
    return `${section}\n\nSee [\`property: ${configClassName}.${name}\`].\n`;
  });
}

function generateFullConfig() {
  generateFullConfigClass('TestConfig', 'FullConfig', [
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
  ]);
}

function generateFullProject() {
  generateFullConfigClass('TestProject', 'FullProject', [
    'grep',
    'grepInvert',
    'metadata',
    'name',
    'dependencies',
    'snapshotDir',
    'outputDir',
    'repeatEach',
    'retries',
    'teardown',
    'testDir',
    'testIgnore',
    'testMatch',
    'timeout',
    'use',
  ]);
}

generateFullConfig();
generateFullProject();
