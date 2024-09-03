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

import { JavaLanguageGenerator } from './java';
import { JavaScriptLanguageGenerator } from './javascript';
import { JsonlLanguageGenerator } from './jsonl';
import { CSharpLanguageGenerator } from './csharp';
import { PythonLanguageGenerator } from './python';

export function languageSet() {
  return new Set([
    new JavaLanguageGenerator('junit'),
    new JavaLanguageGenerator('library'),
    new JavaScriptLanguageGenerator(/* isPlaywrightTest */false),
    new JavaScriptLanguageGenerator(/* isPlaywrightTest */true),
    new PythonLanguageGenerator(/* isAsync */false, /* isPytest */true),
    new PythonLanguageGenerator(/* isAsync */false, /* isPytest */false),
    new PythonLanguageGenerator(/* isAsync */true,  /* isPytest */false),
    new CSharpLanguageGenerator('mstest'),
    new CSharpLanguageGenerator('nunit'),
    new CSharpLanguageGenerator('library'),
    new JsonlLanguageGenerator(),
  ]);
}
