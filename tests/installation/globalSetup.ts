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

import path from 'path';
import fs from 'fs';
import { spawnAsync } from '../../packages/playwright-core/lib/utils/spawnAsync';
import { removeFolders } from '../../packages/playwright-core/lib/utils/fileUtils';
import { TMP_WORKSPACES } from './npmTest';

const PACKAGE_BUILDER_SCRIPT = path.join(__dirname, '..', '..', 'utils', 'pack_package.js');

async function globalSetup() {
  await removeFolders([TMP_WORKSPACES]);
  console.log(`Temporary workspaces will be created in ${TMP_WORKSPACES}. They will not be removed at the end. Set DEBUG=itest to determine which sub-dir a specific test is using.`);
  await fs.promises.mkdir(TMP_WORKSPACES, { recursive: true });

  if (process.env.PWTEST_INSTALLATION_TEST_SKIP_PACKAGE_BUILDS) {
    console.log('Skipped building packages. Unset PWTEST_INSTALLATION_TEST_SKIP_PACKAGE_BUILDS to build packages.');
  } else {
    console.log('Building packages. Set PWTEST_INSTALLATION_TEST_SKIP_PACKAGE_BUILDS to skip.');
    const outputDir = path.join(__dirname, 'output');
    await removeFolders([outputDir]);
    await fs.promises.mkdir(outputDir, { recursive: true });

    const build = async (buildTarget: string, pkgNameOverride?: string) => {
      const outPath = path.resolve(path.join(outputDir, `${buildTarget}.tgz`));
      const { code, stderr, stdout } = await spawnAsync('node', [PACKAGE_BUILDER_SCRIPT, buildTarget, outPath]);
      if (!!code)
        throw new Error(`Failed to build: ${buildTarget}:\n${stderr}\n${stdout}`);
      console.log('Built:', pkgNameOverride || buildTarget);
      return [pkgNameOverride || buildTarget, outPath];
    };

    const builds = await Promise.all([
      build('playwright-core'),
      build('playwright-test', '@playwright/test'),
      build('playwright'),
      build('playwright-chromium'),
      build('playwright-firefox'),
      build('playwright-webkit'),
      build('playwright-browser-chromium', '@playwright/browser-chromium'),
      build('playwright-browser-firefox', '@playwright/browser-firefox'),
      build('playwright-browser-webkit', '@playwright/browser-webkit'),
      build('playwright-ct-react', '@playwright/experimental-ct-react'),
      build('playwright-ct-core', '@playwright/experimental-ct-core'),
    ]);

    const buildPlaywrightTestPlugin = async () => {
      const cwd = path.resolve(path.join(__dirname, `playwright-test-plugin`));
      const tscResult = await spawnAsync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd, shell: process.platform === 'win32' });
      if (tscResult.code)
        throw new Error(`Failed to build playwright-test-plugin:\n${tscResult.stderr}\n${tscResult.stdout}`);
      const packResult = await spawnAsync('npm', ['pack'], { cwd, shell: process.platform === 'win32' });
      if (packResult.code)
        throw new Error(`Failed to build playwright-test-plugin:\n${packResult.stderr}\n${packResult.stdout}`);
      const tgzName = packResult.stdout.trim();
      const outPath = path.resolve(path.join(outputDir, `playwright-test-plugin.tgz`));
      await fs.promises.rename(path.join(cwd, tgzName), outPath);
      console.log('Built: playwright-test-plugin');
      return ['playwright-test-plugin', outPath];
    };
    builds.push(await buildPlaywrightTestPlugin());

    await fs.promises.writeFile(path.join(__dirname, '.registry.json'), JSON.stringify(Object.fromEntries(builds)));
  }
}

export default globalSetup;
