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

import { CSharpLanguageGenerator } from '@isomorphic/codegen/csharp';
import { JavaLanguageGenerator } from '@isomorphic/codegen/java';
import { JavaScriptLanguageGenerator } from '@isomorphic/codegen/javascript';
import { PythonLanguageGenerator } from '@isomorphic/codegen/python';

import type * as actions from '@isomorphic/codegen/actions';
import type { LanguageGenerator } from '@isomorphic/codegen/types';

export type CodegenLanguage = 'typescript' | 'python' | 'java' | 'csharp';

export type CodeItem = string | actions.ActionInContext;

export function actionInContext(action: actions.Action): actions.ActionInContext {
  return { pageGuid: 'page', action, signals: [] };
}

export function renderCode(items: CodeItem[], language: CodegenLanguage): string[] {
  const generator = createGenerator(language);
  generator.reset();
  const options = { browserName: 'chromium', launchOptions: {}, contextOptions: {} };
  const lines: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      lines.push(item);
      continue;
    }
    const text = generator.generateAction(item, options);
    if (text)
      lines.push(...dedent(text).split('\n'));
  }
  return lines;
}

export function secretCode(language: CodegenLanguage, secretName: string): string {
  switch (language) {
    case 'typescript': return `process.env['${secretName}']`;
    case 'python': return `os.environ["${secretName}"]`;
    case 'java': return `System.getenv("${secretName}")`;
    case 'csharp': return `Environment.GetEnvironmentVariable("${secretName}")`;
    default: return `"SECRET_${secretName}"`;
  }
}

export function substituteSecrets(lines: string[], language: CodegenLanguage, secretNames: string[]): string[] {
  if (!secretNames.length)
    return lines;
  return lines.map(line => {
    for (const name of secretNames) {
      for (const quote of [`'`, `"`])
        line = line.replaceAll(`${quote}SECRET_${name}${quote}`, secretCode(language, name));
    }
    return line;
  });
}

function createGenerator(language: CodegenLanguage): LanguageGenerator {
  switch (language) {
    case 'typescript': return new JavaScriptLanguageGenerator(/* isTest */ true);
    case 'python': return new PythonLanguageGenerator(/* isAsync */ false, /* isPyTest */ false);
    case 'java': return new JavaLanguageGenerator('library');
    case 'csharp': return new CSharpLanguageGenerator('library');
  }
}

function dedent(text: string): string {
  const lines = text.split('\n');
  const indents = lines.filter(line => line.trim()).map(line => line.length - line.trimStart().length);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map(line => line.substring(indent)).join('\n');
}
