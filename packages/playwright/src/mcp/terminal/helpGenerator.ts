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
import { commands } from './commands';

import type zodType from 'zod';
import type { AnyCommandSchema } from './command';

function generateCommandHelp(command: AnyCommandSchema) {
  const args: { name: string, description: string }[] = [];

  const shape = command.args ? (command.args as zodType.ZodObject<any>).shape : {};
  for (const [name, schema] of Object.entries(shape)) {
    const zodSchema = schema as zodType.ZodTypeAny;
    const description = zodSchema.description ?? '';
    args.push({ name, description });
  }

  const lines: string[] = [
    `playwright-cli ${command.name} ${Object.keys(shape).map(k => `<${k}>`).join(' ')}`,
    '',
    command.description,
    '',
  ];

  if (args.length) {
    lines.push('Arguments:');
    lines.push(...args.map(({ name, description }) => `  <${name}>\t${description}`));
  }

  if (command.options) {
    lines.push('Options:');
    const optionsShape = (command.options as zodType.ZodObject<any>).shape;
    for (const [name, schema] of Object.entries(optionsShape)) {
      const zodSchema = schema as zodType.ZodTypeAny;
      const description = (zodSchema.description ?? '').toLowerCase();
      lines.push(`  --${name}\t${description}`);
    }
  }

  return lines.join('\n');
}

function generateHelp() {
  const lines: string[] = [];
  lines.push('Usage: playwright-cli <command> [options]');
  lines.push('Commands:');
  for (const command of Object.values(commands))
    lines.push('  ' + generateHelpEntry(command));
  return lines.join('\n');
}

function generateHelpEntry(command: AnyCommandSchema): string {
  const args: { name: string, description: string }[] = [];

  const shape = (command.args as zodType.ZodObject<any>).shape;
  for (const [name, schema] of Object.entries(shape)) {
    const zodSchema = schema as zodType.ZodTypeAny;
    const description = zodSchema.description ?? '';
    args.push({ name, description });
  }

  const prefix = `${command.name} ${Object.keys(shape).map(k => `<${k}>`).join(' ')}`;
  const suffix = command.description.toLowerCase();
  const padding = ' '.repeat(Math.max(1, 40 - prefix.length));
  return prefix + padding + suffix;
}

async function main() {
  const help = {
    global: generateHelp(),
    commands: Object.fromEntries(
        Object.entries(commands).map(([name, command]) => [name, generateCommandHelp(command)])
    ),
  };
  const fileName = path.resolve(__dirname, 'help.json').replace('lib', 'src');
  // eslint-disable-next-line no-console
  console.log('Writing ', path.relative(process.cwd(), fileName));
  await fs.promises.writeFile(fileName, JSON.stringify(help, null, 2));
}

void main();
