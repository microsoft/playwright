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

import * as z from 'zod';
import type zodType from 'zod';

export type Category = 'core' | 'navigation' | 'keyboard' | 'mouse' | 'export' | 'storage' | 'tabs' | 'network' | 'devtools' | 'browsers' | 'config' | 'install';

export type CommandSchema<Args extends zodType.ZodTypeAny, Options extends zodType.ZodTypeAny> = {
  name: string;
  category: Category;
  description: string;
  hidden?: boolean;
  raw?: boolean;
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

// The last positional argument absorbs the remaining argv when its schema accepts an array.
export function isVariadicArg(schema: zodType.ZodTypeAny): boolean {
  if (schema instanceof z.ZodArray)
    return true;
  if (schema instanceof z.ZodUnion)
    return schema.options.some(option => isVariadicArg(option as zodType.ZodTypeAny));
  if (schema instanceof z.ZodOptional)
    return isVariadicArg(schema.unwrap() as zodType.ZodTypeAny);
  if (schema instanceof z.ZodPipe)
    return isVariadicArg(schema.in as zodType.ZodTypeAny);
  return false;
}

export function parseCommand(command: AnyCommandSchema, args: Record<string, string> & { _: string[] }): { toolName: string, toolParams: any } {
  const optionsObject = { ...args } as Record<string, string>;
  delete optionsObject['_'];
  const optionsSchema = (command.options ?? kEmptyOptions).strict();
  const options: Record<string, string> = zodParse(optionsSchema, optionsObject, 'option');

  const argsSchema = (command.args ?? kEmptyArgs).strict();
  const argNames = [...Object.keys(argsSchema.shape)];
  const argv = args['_'].slice(1);
  const variadic = argNames.length > 0 && isVariadicArg(argsSchema.shape[argNames[argNames.length - 1]]);
  if (argv.length > argNames.length && !variadic)
    throw new Error(`error: too many arguments: expected ${argNames.length}, received ${argv.length}`);
  const argsObject: Record<string, string | string[] | undefined> = {};
  argNames.forEach((name, index) => {
    if (variadic && index === argNames.length - 1)
      argsObject[name] = index < argv.length ? argv.slice(index) : undefined;
    else
      argsObject[name] = argv[index];
  });
  const parsedArgsObject: Record<string, string | string[]> = zodParse(argsSchema, argsObject, 'argument');

  const toolName = typeof command.toolName === 'function' ? command.toolName({ ...parsedArgsObject, ...options }) : command.toolName;
  const toolParams = command.toolParams({ ...parsedArgsObject, ...options });
  return { toolName, toolParams };
}

function zodParse(schema: zodType.ZodAny, data: unknown, type: 'option' | 'argument'): any {
  try {
    return schema.parse(data);
  } catch (e) {
    throw new Error((e as zodType.ZodError).issues.map(issue => {
      const keys: string[] = issue.code === 'unrecognized_keys' ? issue.keys : [''];
      const props = keys.map(key => [...issue.path, key].filter(Boolean).join('.'));
      return props.map(prop => {
        const label = type === 'option' ? `'--${prop}' option` : `'${prop}' argument`;
        switch (issue.code) {
          case 'invalid_type':
            return 'error: ' + label + ': ' + issue.message.replace(/Invalid input:/, '').trim();
          case 'invalid_union': {
            const message = issue.errors[0]?.[0]?.message ?? issue.message;
            return 'error: ' + label + ': ' + message.replace(/Invalid input:/, '').trim();
          }
          case 'unrecognized_keys':
            return 'error: unknown ' + label;
          default:
            return 'error: ' + label + ': ' + issue.message;
        }
      });
    }).flat().join('\n'));
  }
}
