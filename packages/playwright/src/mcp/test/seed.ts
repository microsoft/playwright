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

import { mkdirIfNeeded } from '@utils/fileUtils';

import { projectUtils } from '../../runner';

import type { config, FullConfigInternal } from '../../common';

export function seedProject(fullConfig: FullConfigInternal, projectName?: string) {
  if (!projectName)
    return projectUtils.findTopLevelProjects(fullConfig)[0];
  const project = fullConfig.projects.find(p => p.project.name === projectName);
  if (!project)
    throw new Error(`Project ${projectName} not found`);
  return project;
}

export async function findSeedFile(project: config.FullProjectInternal) {
  const files = await projectUtils.collectFilesForProject(project);
  return files.find(file => path.basename(file).includes('seed'));
}

export function defaultSeedFile(project: config.FullProjectInternal) {
  const testDir = project.project.testDir;
  return path.resolve(testDir, 'seed.spec.ts');
}

export async function ensureSeedFile(project: config.FullProjectInternal) {
  const seedFile = await findSeedFile(project);
  if (seedFile)
    return seedFile;
  const seedFilePath = defaultSeedFile(project);
  await mkdirIfNeeded(seedFilePath);
  await fs.promises.writeFile(seedFilePath, seedFileContent);
  return seedFilePath;
}

export const seedFileContent = `import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    // generate code here.
  });
});
`;
