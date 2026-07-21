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

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';

import { libPath } from '../../package';

export const allSkills = ['playwright-cli', 'playwright-component-testing', 'playwright-trace'] as const;

export type SkillName = typeof allSkills[number];
export type SkillTarget = 'claude' | 'agents';

export async function installSkills(skills: readonly SkillName[], target: SkillTarget = 'claude') {
  const cwd = process.cwd();
  for (const skill of skills) {
    const sourceDir = libPath('tools', 'skills', skill);
    if (!fs.existsSync(sourceDir))
      throw new Error(`Skill source directory not found: ${sourceDir}`);
    const destDir = path.join(cwd, `.${target}`, 'skills', skill);
    await fs.promises.cp(sourceDir, destDir, { recursive: true });
    console.log(`✅ Skill installed to \`${path.relative(cwd, destDir)}\`.`);
  }
}
