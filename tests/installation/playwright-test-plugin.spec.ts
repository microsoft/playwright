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

import { test, expect } from './npmTest';
import path from 'path';
import fs from 'fs';

function patchPackageJsonForPreReleaseIfNeeded(tmpWorkspace: string) {
  // It is not currently possible to declare plugin's peerDependency to match
  // various pre-release versions, e.g. "1.38.0-next" and "1.39.1-alpha".
  // See https://github.com/npm/rfcs/pull/397 and https://github.com/npm/node-semver#prerelease-tags.
  //
  // Workaround per https://stackoverflow.com/questions/71479750/npm-install-pre-release-versions-for-peer-dependency.
  const pkg = JSON.parse(fs.readFileSync(path.resolve(tmpWorkspace, 'package.json'), 'utf-8'));
  if (pkg.dependencies['@playwright/test'].match(/\d+\.\d+-\w+/)) {
    console.log(`Setting overrides in package.json to make pre-release version of peer dependency work.`);
    pkg.overrides = { '@playwright/test': '$@playwright/test' };
    fs.writeFileSync(path.resolve(tmpWorkspace, 'package.json'), JSON.stringify(pkg, null, 2));
  }
}

test('npm: @playwright/test plugin should work', async ({ exec, tmpWorkspace }) => {
  await exec('npm i @playwright/test');
  patchPackageJsonForPreReleaseIfNeeded(tmpWorkspace);
  await exec('npm i playwright-test-plugin');
  await exec('npx playwright install chromium');

  const output = await exec('npx playwright test -c . --browser=chromium --reporter=line plugin.spec.ts');
  expect(output).toContain('plugin value: hello from plugin');
  expect(output).toContain('1 passed');

  await exec('npm i typescript@5.2.2 @types/node@18');
  await exec('npx tsc playwright-test-plugin-types.ts');
});

test('pnpm: @playwright/test plugin should work', async ({ exec, tmpWorkspace }) => {
  await exec('pnpm add @playwright/test');
  patchPackageJsonForPreReleaseIfNeeded(tmpWorkspace);
  await exec('pnpm add playwright-test-plugin');
  await exec('pnpm exec playwright install chromium');

  const output = await exec('pnpm exec playwright test -c . --browser=chromium --reporter=line plugin.spec.ts');
  expect(output).toContain('plugin value: hello from plugin');
  expect(output).toContain('1 passed');

  await exec('pnpm add typescript@5.2.2 @types/node@18');
  await exec('pnpm exec tsc playwright-test-plugin-types.ts');
});

test('yarn: @playwright/test plugin should work', async ({ exec, tmpWorkspace }) => {
  await exec('yarn add @playwright/test');
  patchPackageJsonForPreReleaseIfNeeded(tmpWorkspace);
  await exec('yarn add playwright-test-plugin');
  await exec('yarn playwright install chromium');

  const output = await exec('yarn playwright test -c . --browser=chromium --reporter=line plugin.spec.ts');
  expect(output).toContain('plugin value: hello from plugin');
  expect(output).toContain('1 passed');

  await exec('yarn add typescript@5.2.2 @types/node@18');
  await exec('yarn tsc playwright-test-plugin-types.ts');
});
