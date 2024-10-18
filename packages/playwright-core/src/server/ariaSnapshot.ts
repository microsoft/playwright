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

import type { AriaTemplateNode } from './injected/ariaSnapshot';
import { yaml } from '../utilsBundle';
import type { AriaRole } from '@injected/roleUtils';

export function parseAriaSnapshot(text: string): AriaTemplateNode {
  const fragment = yaml.parse(text) as any[];
  const result: AriaTemplateNode = { role: 'fragment' };
  populateNode(result, fragment);
  return result;
}

function populateNode(node: AriaTemplateNode, container: any[]) {
  for (const object of container) {
    if (typeof object === 'string') {
      const { role, name } = parseKey(object);
      node.children = node.children || [];
      node.children.push({ role, name });
      continue;
    }
    for (const key of Object.keys(object)) {
      if (key === 'checked') {
        node.checked = object[key];
        continue;
      }
      if (key === 'disabled') {
        node.disabled = object[key];
        continue;
      }
      if (key === 'expanded') {
        node.expanded = object[key];
        continue;
      }
      if (key === 'level') {
        node.level = object[key];
        continue;
      }
      if (key === 'pressed') {
        node.pressed = object[key];
        continue;
      }
      if (key === 'selected') {
        node.selected = object[key];
        continue;
      }

      const { role, name } = parseKey(key);
      const value = object[key];
      node.children = node.children || [];

      if (role === 'text') {
        node.children.push(valueOrRegex(value));
        continue;
      }

      if (typeof value === 'string') {
        node.children.push({ role, name, children: [valueOrRegex(value)] });
        continue;
      }

      const childNode = { role, name };
      node.children.push(childNode);
      populateNode(childNode, value);
    }
  }
}

function parseKey(key: string) {
  const match = key.match(/^([a-z]+)(?:\s+(?:"([^"]*)"|\/([^\/]*)\/))?$/);
  if (!match)
    throw new Error(`Invalid key ${key}`);

  const role = match[1] as AriaRole | 'text';
  if (match[2])
    return { role, name: match[2] };
  if (match[3])
    return { role, name: new RegExp(match[3]) };
  return { role };
}

function normalizeWhitespace(text: string) {
  return text.replace(/[\r\n\s\t]+/g, ' ').trim();
}

function valueOrRegex(value: string): string | RegExp {
  return value.startsWith('/') && value.endsWith('/') ? new RegExp(value.slice(1, -1)) : normalizeWhitespace(value);
}
