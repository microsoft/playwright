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

import { mkdirIfNeeded } from 'playwright-core/lib/utils';

import { collectFilesForProject, findTopLevelProjects } from '../../runner/projectUtils';

import type { FullConfigInternal, FullProjectInternal } from '../../common/config';

export function seedProject(config: FullConfigInternal, projectName?: string) {
  if (!projectName)
    return findTopLevelProjects(config)[0];
  const project = config.projects.find(p => p.project.name === projectName);
  if (!project)
    throw new Error(`Project ${projectName} not found`);
  return project;
}

export async function ensureSeedTest(project: FullProjectInternal, logNew: boolean) {
  const files = await collectFilesForProject(project);
  const seed = files.find(file => path.basename(file).includes('seed'));
  if (seed)
    return seed;

  const testDir = project.project.testDir;
  const seedFile  = path.resolve(testDir, 'seed.spec.ts');

  if (logNew) {
    // eslint-disable-next-line no-console
    console.log(`Writing file: ${path.relative(process.cwd(), seedFile)}`);
  }

  await mkdirIfNeeded(seedFile);
  await fs.promises.writeFile(seedFile, `import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    // generate code here.
  });
});
`);
  return seedFile;
}
