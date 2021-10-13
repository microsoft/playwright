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
import { execSync } from 'child_process';
import path from 'path';

import { prompt } from 'enquirer';
import colors from 'ansi-colors';

export type Command = {
  command: string;
  name: string;
};

export function executeCommands(cwd: string, commands: Command[]) {
  for (const { command, name } of commands) {
    console.log(`${name} (${command})…`);
    execSync(command, {
      stdio: 'inherit',
      cwd,
    });
  }
}

export async function createFiles(rootDir: string, files: Map<string, string>, force: boolean = false) {
  for (const [relativeFilePath, value] of files) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    if (fs.existsSync(absoluteFilePath) && !force) {
      const { override } = await prompt<{ override: boolean }>({
        type: 'confirm',
        name: 'override',
        message: `${absoluteFilePath} already exists. Override it?`,
        initial: false
      });
      if (!override)
        continue;
    }
    console.log(colors.gray(`Writing ${path.relative(process.cwd(), absoluteFilePath)}.`));
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, value, 'utf-8');
  }
}

export function determinePackageManager(rootDir: string): 'yarn' | 'npm' {
  if (fs.existsSync(path.join(rootDir, 'yarn.lock')))
    return 'yarn';
  if (process.env.npm_config_user_agent)
    return process.env.npm_config_user_agent.includes('yarn') ? 'yarn' : 'npm';
  return 'npm';
}

export function executeTemplate(input: string, args: Record<string, string>): string {
  for (const key in args)
    input = input.replace(`{{${key}}}`, args[key]);
  return input;
}

export function languagetoFileExtension(language: 'JavaScript' | 'TypeScript'): 'js' | 'ts' {
  return language === 'JavaScript' ? 'js' : 'ts';
}
