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
import os from 'os';
import path from 'path';

import { libPath } from '../../package';

export const allSkills = ['playwright-cli', 'playwright-component-testing', 'playwright-trace'] as const;

export type SkillName = typeof allSkills[number];
export type SkillTarget = 'claude' | 'agents';

// Source skill docs use this as the command. Kept literal so GitHub/search still
// reads as a real CLI. At install time it is rewritten when the invoker differs
// (e.g. `npx`/`yarn`/`pnpm exec` playwright cli), while skill identity and
// artifact paths stay put.
const sourceCliCommand = 'playwright-cli';

export async function installSkills(skills: readonly SkillName[], target: SkillTarget = 'claude', options?: { global?: boolean, cliCommand?: string }) {
  const cwd = process.cwd();
  const baseDir = options?.global ? os.homedir() : cwd;
  for (const skill of skills) {
    const sourceDir = libPath('tools', 'skills', skill);
    if (!fs.existsSync(sourceDir))
      throw new Error(`Skill source directory not found: ${sourceDir}`);
    const destDir = path.join(baseDir, `.${target}`, 'skills', skill);
    await copySkillDir(sourceDir, destDir, options?.cliCommand || sourceCliCommand);
    console.log(`✅ Skill installed to \`${options?.global ? destDir : path.relative(cwd, destDir)}\`.`);
  }
}

async function copySkillDir(sourceDir: string, destDir: string, cliCommand: string) {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copySkillDir(from, to, cliCommand);
      continue;
    }
    if (!entry.isFile())
      continue;
    const content = await fs.promises.readFile(from, 'utf8');
    await fs.promises.writeFile(to, rewriteCliCommand(content, cliCommand));
  }
}

function rewriteCliCommand(content: string, cliCommand: string): string {
  // Must not contain `playwright-cli`, or the bulk replace below would rewrite it.
  const protectedToken = '\0PWCLI\0';
  return content
      .replaceAll(`name: ${sourceCliCommand}`, `name: ${protectedToken}`)
      .replaceAll(`Bash(${sourceCliCommand}:*)`, `Bash(${protectedToken}:*)`)
      .replaceAll(`.${sourceCliCommand}/`, `.${protectedToken}/`)
      .replaceAll(sourceCliCommand, cliCommand)
      .replaceAll(protectedToken, sourceCliCommand);
}
