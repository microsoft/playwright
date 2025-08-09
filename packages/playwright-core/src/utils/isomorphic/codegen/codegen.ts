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

import { CSharpLanguageGenerator } from './csharp';
import { JavaLanguageGenerator } from './java';
import { JavaScriptLanguageGenerator } from './javascript';
import { JsonlLanguageGenerator } from './jsonl';
import { PythonLanguageGenerator } from './python';

import type { Language } from '../locatorGenerators';
import type * as actions from '@recorder/actions';
import type { BrowserContextOptions, LaunchOptions } from 'playwright-core';
export type { Language } from '../locatorGenerators';

export interface LanguageGenerator {
  id: string;
  groupName: string;
  name: string;
  highlighter: Language;
  generateHeader(options: LanguageGeneratorOptions): string;
  generateAction(actionInContext: actions.ActionInContext): string;
  generateFooter(saveStorage: string | undefined): string;
}

export type LanguageGeneratorOptions = {
  browserName: string;
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
  deviceName?: string;
  saveStorage?: string;
};

export function languageSet(): Set<LanguageGenerator> {
  return new Set([
    new JavaScriptLanguageGenerator(/* isPlaywrightTest */true),
    new JavaScriptLanguageGenerator(/* isPlaywrightTest */false),
    new PythonLanguageGenerator(/* isAsync */false, /* isPytest */true),
    new PythonLanguageGenerator(/* isAsync */false, /* isPytest */false),
    new PythonLanguageGenerator(/* isAsync */true,  /* isPytest */false),
    new CSharpLanguageGenerator('mstest'),
    new CSharpLanguageGenerator('nunit'),
    new CSharpLanguageGenerator('library'),
    new JavaLanguageGenerator('junit'),
    new JavaLanguageGenerator('library'),
    new JsonlLanguageGenerator(),
  ]);
}

export function generateCode(actions: actions.ActionInContext[], languageGenerator: LanguageGenerator, options: LanguageGeneratorOptions) {
  const header = languageGenerator.generateHeader(options);
  const footer = languageGenerator.generateFooter(options.saveStorage);
  const actionTexts = actions.map(a => generateActionText(languageGenerator, a)).filter(Boolean) as string[];
  const text = [header, ...actionTexts, footer].join('\n');
  return { header, footer, actionTexts, text };
}

function generateActionText(generator: LanguageGenerator, action: actions.ActionInContext): string | undefined {
  let text = generator.generateAction(action);
  if (!text)
    return;
  if (action.action.preconditionSelector) {
    const expectAction: actions.ActionInContext = {
      frame: action.frame,
      startTime: action.startTime,
      endTime: action.startTime,
      action: {
        name: 'assertVisible',
        selector: action.action.preconditionSelector,
        signals: [],
      },
    };
    const expectText = generator.generateAction(expectAction);
    if (expectText)
      text = expectText + '\n' + text;
  }
  return text;
}
