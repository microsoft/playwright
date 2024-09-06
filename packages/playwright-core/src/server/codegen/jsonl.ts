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

import { asLocator } from '../../utils';
import type { ActionInContext, Language, LanguageGenerator, LanguageGeneratorOptions } from './types';

export class JsonlLanguageGenerator implements LanguageGenerator {
  id = 'jsonl';
  groupName = '';
  name = 'JSONL';
  highlighter = 'javascript' as Language;

  generateAction(actionInContext: ActionInContext): string {
    const locator = (actionInContext.action as any).selector ? JSON.parse(asLocator('jsonl', (actionInContext.action as any).selector)) : undefined;
    const entry = {
      ...actionInContext.action,
      pageAlias: actionInContext.frame.pageAlias,
      locator,
    };
    return JSON.stringify(entry);
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    return JSON.stringify(options);
  }

  generateFooter(saveStorage: string | undefined): string {
    return '';
  }
}
