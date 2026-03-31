/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
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

export async function installSkill() {
  const cwd = process.cwd();
  const skillSource = path.join(__dirname, 'SKILL.md');
  const destDir = path.join(cwd, '.claude', 'skills', 'playwright-trace');
  await fs.promises.mkdir(destDir, { recursive: true });
  const destFile = path.join(destDir, 'SKILL.md');
  await fs.promises.copyFile(skillSource, destFile);
  console.log(`✅ Skill installed to \`${path.relative(cwd, destFile)}\`.`);
}
