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

import { escapeRegExp, longestCommonSubstring } from './stringUtils';
import { yamlEscapeKeyIfNeeded, yamlEscapeValueIfNeeded } from './yaml';

import type { AriaNodeJSON, AriaSnapshotJSON } from './ariaSnapshot';

export type AriaSnapshotYamlOptions = {
  convertStringsToRegex?: boolean;
  lineToNode?: Map<number, AriaNodeJSON>;
};

export function renderAriaSnapshotAsYaml(snapshot: AriaSnapshotJSON, options: AriaSnapshotYamlOptions = {}): string {
  const lines: string[] = [];
  const includeText = options.convertStringsToRegex ? textContributesInfo : () => true;
  const renderString = options.convertStringsToRegex ? convertToBestGuessRegex : (str: string) => str;

  const visitText = (text: string, depth: number) => {
    const escaped = yamlEscapeValueIfNeeded(renderString(text));
    if (escaped)
      lines.push(indent(depth) + '- text: ' + escaped);
  };

  const createKey = (node: AriaNodeJSON): string => {
    let key: string = node.role;
    // Yaml has a limit of 1024 characters per key, and we leave some space for role and attributes.
    if (node.name && node.name.length <= 900) {
      const name = renderString(node.name);
      if (name) {
        const stringifiedName = name.startsWith('/') && name.endsWith('/') ? name : JSON.stringify(name);
        key += ' ' + stringifiedName;
      }
    }
    if (node.checked === 'mixed')
      key += ` [checked=mixed]`;
    if (node.checked === true)
      key += ` [checked]`;
    if (node.disabled)
      key += ` [disabled]`;
    if (node.expanded)
      key += ` [expanded]`;
    if (node.active)
      key += ` [active]`;
    if (node.invalid === 'grammar' || node.invalid === 'spelling')
      key += ` [invalid=${node.invalid}]`;
    if (node.invalid === true)
      key += ` [invalid]`;
    if (node.level)
      key += ` [level=${node.level}]`;
    if (node.pressed === 'mixed')
      key += ` [pressed=mixed]`;
    if (node.pressed === true)
      key += ` [pressed]`;
    if (node.selected === true)
      key += ` [selected]`;
    if (node.ariaHidden)
      key += ` [aria-hidden]`;
    if (node.ref) {
      key += ` [ref=${node.ref}]`;
      if (node.cursor === 'pointer')
        key += ' [cursor=pointer]';
    }
    if (node.box)
      key += ` [box=${node.box.x},${node.box.y},${node.box.width},${node.box.height}]`;
    return key;
  };

  const visit = (node: AriaNodeJSON, depth: number) => {
    if (node.role === 'text') {
      visitText(node.text || '', depth);
      return;
    }

    options.lineToNode?.set(lines.length, node);
    const escapedKey = indent(depth) + '- ' + yamlEscapeKeyIfNeeded(createKey(node));
    const props: [string, string][] = [];
    if (node.url !== undefined)
      props.push(['url', node.url]);
    if (node.placeholder !== undefined)
      props.push(['placeholder', node.placeholder]);

    if (node.text === undefined && !props.length && !node.children?.length) {
      // Leaf node without children.
      lines.push(escapedKey);
    } else if (node.text !== undefined && !props.length) {
      // Leaf node with just some text inside.
      if (includeText(node, node.text))
        lines.push(escapedKey + ': ' + yamlEscapeValueIfNeeded(renderString(node.text)));
      else
        lines.push(escapedKey);
    } else {
      // Node with (optional) props and some children.
      lines.push(escapedKey + ':');
      for (const [name, value] of props)
        lines.push(indent(depth + 1) + '- /' + name + ': ' + yamlEscapeValueIfNeeded(value));
      if (node.text !== undefined) {
        visitText(includeText(node, node.text) ? node.text : '', depth + 1);
      } else {
        for (const child of node.children || []) {
          if (typeof child === 'string')
            visitText(includeText(node, child) ? child : '', depth + 1);
          else
            visit(child, depth + 1);
        }
      }
    }
  };

  for (const node of snapshot)
    visit(node, 0);
  return lines.join('\n');
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function convertToBestGuessRegex(text: string): string {
  const dynamicContent = [
    // 550e8400-e29b-41d4-a716-446655440000
    { regex: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/, replacement: '[0-9a-fA-F-]+' },
    // 2mb
    { regex: /\b[\d,.]+[bkmBKM]+\b/, replacement: '[\\d,.]+[bkmBKM]+' },
    // 2ms, 20s
    { regex: /\b\d+[hmsp]+\b/, replacement: '\\d+[hmsp]+' },
    { regex: /\b[\d,.]+[hmsp]+\b/, replacement: '[\\d,.]+[hmsp]+' },
    // Do not replace single digits with regex by default.
    // 2+ digits: [Issue 22, 22.3, 2.33, 2,333]
    { regex: /\b\d+,\d+\b/, replacement: '\\d+,\\d+' },
    { regex: /\b\d+\.\d{2,}\b/, replacement: '\\d+\\.\\d+' },
    { regex: /\b\d{2,}\.\d+\b/, replacement: '\\d+\\.\\d+' },
    { regex: /\b\d{2,}\b/, replacement: '\\d+' },
  ];

  let pattern = '';
  let lastIndex = 0;

  const combinedRegex = new RegExp(dynamicContent.map(r => '(' + r.regex.source + ')').join('|'), 'g');
  text.replace(combinedRegex, (match, ...args) => {
    const offset = args[args.length - 2];
    const groups = args.slice(0, -2);
    pattern += escapeRegExp(text.slice(lastIndex, offset));
    for (let i = 0; i < groups.length; i++) {
      if (groups[i]) {
        const { replacement } = dynamicContent[i];
        pattern += replacement;
        break;
      }
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (!pattern)
    return text;

  pattern += escapeRegExp(text.slice(lastIndex));
  return String(new RegExp(pattern));
}

function textContributesInfo(node: AriaNodeJSON, text: string): boolean {
  if (!text.length)
    return false;

  if (!node.name)
    return true;

  // Figure out if text adds any value. "longestCommonSubstring" is expensive, so limit strings length.
  const substr = (text.length <= 200 && node.name.length <= 200) ? longestCommonSubstring(text, node.name) : '';
  let filtered = text;
  while (substr && filtered.includes(substr))
    filtered = filtered.replace(substr, '');
  return filtered.trim().length / text.length > 0.1;
}
