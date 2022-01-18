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
//@ts-check

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const { packages, packagesToPublish } = require('./list_packages.js');

(async () => {
  const version = process.argv[2];
  if (!version)
    throw new Error('Please specify version! See --help for more information.');
  if (version.startsWith('v'))
    throw new Error('Version must not start with "v"');
  if (process.argv[2] === '--help')
    throw new Error(`Usage: node ${path.relative(process.cwd(), __filename)} <version>`);
  const rootDir = path.join(__dirname, '..');

  // 1. update the package.json (playwright-internal) with the new version
  execSync(`npm version --no-git-tag-version ${version}`, {
    stdio: 'inherit',
    cwd: rootDir,
  });
  // 2. Distribute new version to all packages and its dependencies
  execSync(`node ${path.join(__dirname, 'prepare_packages.js')}`, {
    stdio: 'inherit',
    cwd: rootDir,
  });

  // 3. update the package-lock.json (playwright-internal) with the new version.
  // Workaround for: https://github.com/npm/cli/issues/3940
  {
    const packageLockPath = path.join(rootDir, 'package-lock.json');
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    const publicPackages = new Set(packagesToPublish.map(package => path.basename(package)));
    for (const package of packages.map(package => path.basename(package))) {
      const playwrightCorePackages = packageLock['packages']['packages/' + package];
      if (publicPackages.has(package))
        playwrightCorePackages.version = version;
      if (playwrightCorePackages.dependencies && playwrightCorePackages.dependencies['playwright-core'])
        packageLock['packages']['packages/playwright-test']['dependencies']['playwright-core'] = '=' + version;
    }
    fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
  }

})().catch(err => {
  console.error(err);
  process.exit(1);
})
