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

import { commands } from './commands';

import type zodType from 'zod';
import type { AnyCommandSchema, Category } from './command';

type CommandArg = { name: string, description: string, optional: boolean };

function commandArgs(command: AnyCommandSchema): CommandArg[] {
  const args: CommandArg[] = [];
  const shape = command.args ? (command.args as zodType.ZodObject<any>).shape : {};
  for (const [name, schema] of Object.entries(shape)) {
    const zodSchema = schema as zodType.ZodTypeAny;
    const description = zodSchema.description ?? '';
    args.push({ name, description, optional: zodSchema.safeParse(undefined).success });
  }
  return args;
}

function commandArgsText(args: CommandArg[]) {
  return args.map(a => a.optional ? `[${a.name}]` : `<${a.name}>`).join(' ');
}

function generateCommandHelp(command: AnyCommandSchema) {
  const args = commandArgs(command);
  const lines: string[] = [
    `playwright-cli ${command.name} ${commandArgsText(args)}`,
    '',
    command.description,
    '',
  ];

  if (args.length) {
    lines.push('Arguments:');
    lines.push(...args.map(a => formatWithGap(`  ${a.optional ? `[${a.name}]` : `<${a.name}>`}`, a.description.toLowerCase())));
  }

  if (command.options) {
    lines.push('Options:');
    const optionsShape = (command.options as zodType.ZodObject<any>).shape;
    for (const [name, schema] of Object.entries(optionsShape)) {
      const zodSchema = schema as zodType.ZodTypeAny;
      const description = (zodSchema.description ?? '').toLowerCase();
      lines.push(formatWithGap(`  --${name}`, description));
    }
  }

  return lines.join('\n');
}

const categories: { name: Category, title: string }[] = [
  { name: 'core', title: 'Core' },
  { name: 'navigation', title: 'Navigation' },
  { name: 'keyboard', title: 'Keyboard' },
  { name: 'mouse', title: 'Mouse' },
  { name: 'export', title: 'Save as' },
  { name: 'tabs', title: 'Tabs' },
  { name: 'storage', title: 'Storage' },
  { name: 'devtools', title: 'DevTools' },
  { name: 'config', title: 'Configuration' },
  { name: 'session', title: 'Sessions' },
] as const;

export function generateHelp() {
  const lines: string[] = [];
  lines.push('Usage: playwright-cli <command> [args] [options]');

  const commandsByCategory = new Map<string, AnyCommandSchema[]>();
  for (const c of categories)
    commandsByCategory.set(c.name, []);
  for (const command of Object.values(commands))
    commandsByCategory.get(command.category)!.push(command);

  for (const c of categories) {
    const cc = commandsByCategory.get(c.name)!;
    if (!cc.length)
      continue;
    lines.push(`\n${c.title}:`);
    for (const command of cc)
      lines.push(generateHelpEntry(command));
  }

  lines.push('\nGlobal options:');
  lines.push(formatWithGap('  --config <path>', 'create a session with custom config, defaults to `playwright-cli.json`'));
  lines.push(formatWithGap('  --extension', 'connect to a running browser instance using Playwright MCP Bridge extension'));
  lines.push(formatWithGap('  --headed', 'create a headed session'));
  lines.push(formatWithGap('  --help [command]', 'print help'));
  lines.push(formatWithGap('  --session', 'run command in the scope of a specific session'));
  lines.push(formatWithGap('  --version', 'print version'));

  return lines.join('\n');
}


export function generateReadme() {
  const lines: string[] = [];
  lines.push('\n## Commands');

  const commandsByCategory = new Map<string, AnyCommandSchema[]>();
  for (const c of categories)
    commandsByCategory.set(c.name, []);
  for (const command of Object.values(commands))
    commandsByCategory.get(command.category)!.push(command);

  for (const c of categories) {
    const cc = commandsByCategory.get(c.name)!;
    if (!cc.length)
      continue;
    lines.push(`\n### ${c.title}\n`);
    lines.push('```bash');
    for (const command of cc)
      lines.push(generateReadmeEntry(command));
    lines.push('```');
  }
  return lines.join('\n');
}

function generateHelpEntry(command: AnyCommandSchema): string {
  const args = commandArgs(command);
  const prefix = `  ${command.name} ${commandArgsText(args)}`;
  const suffix = command.description.toLowerCase();
  return formatWithGap(prefix, suffix);
}

function generateReadmeEntry(command: AnyCommandSchema): string {
  const args = commandArgs(command);
  const prefix = `playwright-cli ${command.name} ${commandArgsText(args)}`;
  const suffix = '# ' + command.description.toLowerCase();
  return formatWithGap(prefix, suffix, 40);
}

export function generateHelpJSON() {
  const help = {
    global: generateHelp(),
    commands: Object.fromEntries(
        Object.entries(commands).map(([name, command]) => [name, generateCommandHelp(command)])
    ),
  };
  return help;
}

function formatWithGap(prefix: string, text: string, threshold: number = 30) {
  const indent = Math.max(1, threshold - prefix.length);
  return prefix + ' '.repeat(indent) + text;
}
