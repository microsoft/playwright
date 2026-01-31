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

import { z } from 'playwright-core/lib/mcpBundle';

import type zodType from 'zod';

export type Category = 'core' | 'navigation' | 'keyboard' | 'mouse' | 'export' | 'storage' | 'tabs' | 'devtools' | 'session' | 'config' | 'install';

export type CommandSchema<Args extends zodType.ZodTypeAny, Options extends zodType.ZodTypeAny> = {
  name: string;
  category: Category;
  description: string;
  args?: Args;
  options?: Options;
  toolName: string | ((args: zodType.infer<Args> & zodType.infer<Options>) => string);
  toolParams: (args: zodType.infer<Args> & zodType.infer<Options>) => any;
};

export type AnyCommandSchema = CommandSchema<any, any>;

export function declareCommand<Args extends zodType.ZodTypeAny, Options extends zodType.ZodTypeAny>(command: CommandSchema<Args, Options>): CommandSchema<Args, Options> {
  return command;
}

const kEmptyOptions = z.object({});
const kEmptyArgs = z.object({});

export function parseCommand(command: AnyCommandSchema, args: Record<string, string> & { _: string[] }): { toolName: string, toolParams: any } {
  const optionsObject = { ...args } as Record<string, string>;
  delete optionsObject['_'];
  const optionsSchema = (command.options ?? kEmptyOptions).strict();
  const options: Record<string, string> = zodParse(optionsSchema, optionsObject, 'option');

  const argsSchema = (command.args ?? kEmptyArgs).strict();
  const argNames = [...Object.keys(argsSchema.shape)];
  const argv = args['_'].slice(1);
  if (argv.length > argNames.length)
    throw new Error(`error: too many arguments: expected ${argNames.length}, received ${argv.length}`);
  const argsObject: Record<string, string> = {};
  argNames.forEach((name, index) => argsObject[name] = argv[index]);
  const parsedArgsObject: Record<string, string> = zodParse(argsSchema, argsObject, 'argument');

  const toolName = typeof command.toolName === 'function' ? command.toolName({ ...parsedArgsObject, ...options }) : command.toolName;
  const toolParams = command.toolParams({ ...parsedArgsObject, ...options });
  return { toolName, toolParams };
}

function zodParse(schema: zodType.ZodAny, data: unknown, type: 'option' | 'argument'): any {
  try {
    return schema.parse(data);
  } catch (e) {
    throw new Error((e as zodType.ZodError).issues.map(issue => {
      const keys: string[] = (issue as any).keys || [''];
      const props = keys.map(key => [...issue.path, key].filter(Boolean).join('.'));
      return props.map(prop => {
        const label = type === 'option' ? `'--${prop}' option` : `'${prop}' argument`;
        switch (issue.code) {
          case 'invalid_type':
            return 'error: ' + label + ': ' + issue.message.toLowerCase().replace(/invalid input:/, '').trim();
          case 'unrecognized_keys':
            return 'error: unknown ' + label;
          default:
            return 'error: ' + label + ': ' + issue.message.toLowerCase();
        }
      });
    }).flat().join('\n'));
  }
}
