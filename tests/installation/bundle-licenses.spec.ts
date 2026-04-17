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
import fs from 'fs';
import path from 'path';
import { test, expect } from './npmTest';

// Lower bounds on the number of inlined npm packages per LICENSE. If a bundle drops below
// these, something is broken with bundle generation or dependencies were silently removed.
const EXPECTED: Record<string, Record<string, number>> = {
  'playwright-core': {
    'lib/serverRegistry.js.LICENSE': 10,
    'lib/utilsBundle.js.LICENSE': 80,
  },
  'playwright': {
    'lib/matchers/expect.js.LICENSE': 30,
    'lib/transform/esmLoader.js.LICENSE': 10,
    'lib/transform/babelBundle.js.LICENSE': 65,
  },
};

async function collectLicenses(dir: string): Promise<string[]> {
  const result: string[] = [];
  const walk = async (d: string) => {
    const entries = await fs.promises.readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory())
        await walk(p);
      else if (e.name.endsWith('.LICENSE'))
        result.push(p);
    }
  };
  await walk(dir);
  return result.sort();
}

for (const [pkg, licenses] of Object.entries(EXPECTED)) {
  test(`${pkg} bundles ship .LICENSE files with expected package counts`, async ({ exec, tmpWorkspace }) => {
    const registry = JSON.parse(await fs.promises.readFile(path.join(__dirname, '.registry.json'), 'utf8'));
    const tarball: string = registry[pkg];
    expect(tarball, `no tarball recorded for ${pkg} in .registry.json`).toBeTruthy();

    const extractDir = path.join(tmpWorkspace, `extract-${pkg}`);
    await fs.promises.mkdir(extractDir, { recursive: true });
    await exec('tar', '-xzf', tarball, '-C', extractDir);

    const libDir = path.join(extractDir, 'package', 'lib');
    const found = await collectLicenses(libDir);
    const expected = Object.keys(licenses).map(p => path.join(libDir, ...p.slice('lib/'.length).split('/'))).sort();
    expect(found, `LICENSE files under ${pkg}/lib do not match the expected set — update EXPECTED`).toEqual(expected);

    for (const [relPath, minPackages] of Object.entries(licenses)) {
      const absPath = path.join(extractDir, 'package', relPath);
      const contents = await fs.promises.readFile(absPath, 'utf8');
      const match = contents.match(/^Total Packages: (\d+)$/m);
      expect(match, `${pkg}/${relPath} is missing the "Total Packages" summary line`).toBeTruthy();
      const count = Number(match![1]);
      test.info().annotations.push({ type: 'licenses', description: `${pkg}/${relPath}: ${count} packages` });
      expect(count, `${pkg}/${relPath} lists only ${count} packages, expected at least ${minPackages}`).toBeGreaterThanOrEqual(minPackages);
    }
  });
}
