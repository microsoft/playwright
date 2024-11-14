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

import { parseYamlTemplate } from '../utils/isomorphic/ariaSnapshot';
import type { AriaTemplateNode, ParsedYaml } from '@isomorphic/ariaSnapshot';
import { yaml } from '../utilsBundle';

export function parseAriaSnapshot(text: string): AriaTemplateNode {
  return parseYamlTemplate(parseYamlForAriaSnapshot(text));
}

export function parseYamlForAriaSnapshot(text: string): ParsedYaml {
  const parsed = yaml.parse(text);
  if (!Array.isArray(parsed))
    throw new Error('Expected object key starting with "- ":\n\n' + text + '\n');
  return parsed;
}
