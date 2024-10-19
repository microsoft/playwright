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
import { assert } from '../utils';

export function parseAriaSnapshot(text: string): AriaTemplateNode {
  const fragment = yaml.parse(text) as any[];
  const result: AriaTemplateNode = { role: 'fragment' };
  populateNode(result, fragment);
  return result;
}

function populateNode(node: AriaTemplateNode, container: any[]) {
  for (const object of container) {
    if (typeof object === 'string') {
      const childNode = parseKey(object);
      node.children = node.children || [];
      node.children.push(childNode);
      continue;
    }

    for (const key of Object.keys(object)) {
      const childNode = parseKey(key);
      const value = object[key];
      node.children = node.children || [];

      if (childNode.role === 'text') {
        node.children.push(valueOrRegex(value));
        continue;
      }

      if (typeof value === 'string') {
        node.children.push({ ...childNode, children: [valueOrRegex(value)] });
        continue;
      }

      node.children.push(childNode);
      populateNode(childNode, value);
    }
  }
}

function applyAttribute(node: AriaTemplateNode, key: string, value: string) {
  if (key === 'checked') {
    assert(value === 'true' || value === 'false' || value === 'mixed', 'Value of "disabled" attribute must be a boolean or "mixed"');
    node.checked = value === 'true' ? true : value === 'false' ? false : 'mixed';
    return;
  }
  if (key === 'disabled') {
    assert(value === 'true' || value === 'false', 'Value of "disabled" attribute must be a boolean');
    node.disabled = value === 'true';
    return;
  }
  if (key === 'expanded') {
    assert(value === 'true' || value === 'false', 'Value of "expanded" attribute must be a boolean');
    node.expanded = value === 'true';
    return;
  }
  if (key === 'level') {
    assert(!isNaN(Number(value)), 'Value of "level" attribute must be a number');
    node.level = Number(value);
    return;
  }
  if (key === 'pressed') {
    assert(value === 'true' || value === 'false' || value === 'mixed', 'Value of "pressed" attribute must be a boolean or "mixed"');
    node.pressed = value === 'true' ? true : value === 'false' ? false : 'mixed';
    return;
  }
  if (key === 'selected') {
    assert(value === 'true' || value === 'false', 'Value of "selected" attribute must be a boolean');
    node.selected = value === 'true';
    return;
  }
  throw new Error(`Unsupported attribute [${key}] `);
}

function parseKey(key: string): AriaTemplateNode {
  const tokenRegex = /\s*([a-z]+|"(?:[^"]*)"|\/(?:[^\/]*)\/|\[.*?\])/g;
  let match;
  const tokens = [];
  while ((match = tokenRegex.exec(key)) !== null)
    tokens.push(match[1]);

  if (tokens.length === 0)
    throw new Error(`Invalid key ${key}`);

  const role = tokens[0] as AriaRole | 'text';

  let name: string | RegExp = '';
  let index = 1;
  if (tokens.length > 1 && (tokens[1].startsWith('"') || tokens[1].startsWith('/'))) {
    const nameToken = tokens[1];
    if (nameToken.startsWith('"')) {
      name = nameToken.slice(1, -1);
    } else {
      const pattern = nameToken.slice(1, -1);
      name = new RegExp(pattern);
    }
    index = 2;
  }

  const result: AriaTemplateNode = { role, name };
  for (; index < tokens.length; index++) {
    const attrToken = tokens[index];
    if (attrToken.startsWith('[') && attrToken.endsWith(']')) {
      const attrContent = attrToken.slice(1, -1).trim();
      const [attrName, attrValue] = attrContent.split('=', 2);
      const value = attrValue !== undefined ? attrValue.trim() : 'true';
      applyAttribute(result, attrName, value);
    } else {
      throw new Error(`Invalid attribute token ${attrToken} in key ${key}`);
    }
  }

  return result;
}

function normalizeWhitespace(text: string) {
  return text.replace(/[\r\n\s\t]+/g, ' ').trim();
}

function valueOrRegex(value: string): string | RegExp {
  return value.startsWith('/') && value.endsWith('/') ? new RegExp(value.slice(1, -1)) : normalizeWhitespace(value);
}
