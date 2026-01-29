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

import type zodType from 'zod';

export type Category = 'core' | 'navigation' | 'keyboard' | 'mouse' | 'export' | 'storage' | 'tabs' | 'devtools' | 'session' | 'config';

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

export function parseCommand(command: AnyCommandSchema, args: Record<string, string> & { _: string[] }): { toolName: string, toolParams: any } {
  const shape = command.args ? (command.args as zodType.ZodObject<any>).shape : {};
  const argv = args['_'];
  const options = command.options?.parse({ ...args, _: undefined }) ?? {};
  const argsObject: Record<string, string> = {};
  let i = 0;
  for (const name of Object.keys(shape))
    argsObject[name] = argv[++i];

  let parsedArgsObject: Record<string, string> = {};
  try {
    parsedArgsObject = command.args?.parse(argsObject) ?? {};
  } catch (e) {
    throw new Error(formatZodError(e as zodType.ZodError));
  }

  const toolName = typeof command.toolName === 'function' ? command.toolName({ ...parsedArgsObject, ...options }) : command.toolName;
  const toolParams = command.toolParams({ ...parsedArgsObject, ...options });
  return { toolName, toolParams };
}

function formatZodError(error: zodType.ZodError): string {
  const issue = error.issues[0];
  if (issue.code === 'invalid_type')
    return `${issue.message} in <${issue.path.join('.')}>`;
  return error.issues.map(i => i.message).join('\n');
}
