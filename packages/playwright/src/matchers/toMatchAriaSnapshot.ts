/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import type { LocatorEx } from './matchers';
import type { ExpectMatcherState } from '../../types/test';
import { kNoElementsFoundError, matcherHint, type MatcherResult } from './matcherHint';
import type { AriaTemplateNode } from 'playwright-core/lib/server/injected/ariaSnapshot';
import { yaml } from '../utilsBundle';
import { colors } from 'playwright-core/lib/utilsBundle';
import { EXPECTED_COLOR } from '../common/expectBundle';
import { callLogText } from '../util';
import { printReceivedStringContainExpectedSubstring } from './expect';

export async function toMatchAriaSnapshot(
  this: ExpectMatcherState,
  receiver: LocatorEx,
  expected: string,
  options: { timeout?: number, matchSubstring?: boolean } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  const matcherName = 'toMatchAriaSnapshot';

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  if (typeof expected !== 'string') {
    throw new Error([
      matcherHint(this, receiver, matcherName, receiver, expected, matcherOptions),
      `${colors.bold('Matcher error')}: ${EXPECTED_COLOR('expected',)} value must be a string`,
      this.utils.printWithType('Expected', expected, this.utils.printExpected)
    ].join('\n\n'));
  }

  const ariaTree = toAriaTree(expected) as AriaTemplateNode;
  const timeout = options.timeout ?? this.timeout;
  const { matches: pass, received, log, timedOut } = await receiver._expect('to.match.aria', { expectedValue: ariaTree, isNot: this.isNot, timeout });

  const messagePrefix = matcherHint(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined);
  const notFound = received === kNoElementsFoundError;
  const message = () => {
    if (pass) {
      if (notFound)
        return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${received}` + callLogText(log);
      const printedReceived = printReceivedStringContainExpectedSubstring(received, received.indexOf(expected), expected.length);
      return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived string: ${printedReceived}` + callLogText(log);
    } else {
      const labelExpected = `Expected`;
      if (notFound)
        return messagePrefix + `${labelExpected}: ${this.utils.printExpected(expected)}\nReceived: ${received}` + callLogText(log);
      return messagePrefix + this.utils.printDiffOrStringify(expected, received, labelExpected, 'Received string', false) + callLogText(log);
    }
  };

  return {
    name: matcherName,
    expected,
    message,
    pass,
    actual: received,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}

function parseKey(key: string): AriaTemplateNode {
  if (!key)
    return { role: '' };

  const match = key.match(/^([a-z]+)(?:\s+(?:"([^"]*)"|\/([^\/]*)\/))?$/);

  if (!match)
    throw new Error(`Invalid key ${key}`);

  const role = match[1];
  if (role && role !== 'text' && !allRoles.includes(role))
    throw new Error(`Invalid role ${role}`);

  if (match[2])
    return { role, name: match[2] };
  if (match[3])
    return { role, name: new RegExp(match[3]) };
  return { role };
}

function valueOrRegex(value: string): string | RegExp {
  return value.startsWith('/') && value.endsWith('/') ? new RegExp(value.slice(1, -1)) : value;
}

type YamlNode = Record<string, Array<YamlNode> | string>;

function toAriaTree(text: string): AriaTemplateNode {
  const convert = (object: YamlNode | string): AriaTemplateNode | RegExp | string => {
    const key = typeof object === 'string' ? object : Object.keys(object)[0];
    const value = typeof object === 'string' ? undefined : object[key];
    const parsed = parseKey(key);
    if (parsed.role === 'text') {
      if (typeof value !== 'string')
        throw new Error(`Generic role must have a text value`);
      return valueOrRegex(value as string);
    }
    if (Array.isArray(value))
      parsed.children = value.map(convert);
    else if (value)
      parsed.children = [valueOrRegex(value)];
    return parsed;
  };
  const fragment = yaml.parse(text) as YamlNode[];
  return convert({ '': fragment }) as AriaTemplateNode;
}

const allRoles = [
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption', 'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'command',
  'complementary', 'composite', 'contentinfo', 'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid',
  'gridcell', 'group', 'heading', 'img', 'input', 'insertion', 'landmark', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'meter', 'menu',
  'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup',
  'range', 'region', 'roletype', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'section', 'sectionhead', 'select', 'separator', 'slider',
  'spinbutton', 'status', 'strong', 'structure', 'subscript', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer',
  'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem', 'widget', 'window'
];
