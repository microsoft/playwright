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
import type { MatcherResult } from './matcherHint';
import type { AriaTemplateNode, AriaTemplateString } from 'playwright-core/lib/server/injected/ariaSnapshot';

export async function toMatchAriaSnapshot(
  this: ExpectMatcherState,
  locator: LocatorEx,
  expected: JSX.Element,
  options: { timeout?: number, matchSubstring?: boolean } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  const timeout = options.timeout ?? this.timeout;
  const ariaTree = jsxToAriaTree(expected) as AriaTemplateNode;
  normalizeStringChildren(ariaTree);
  const result = await locator._expect('to.match.aria', { expectedValue: ariaTree, isNot: this.isNot, timeout });
  return {
    name: 'toMatchAriaSnapshot',
    expected: JSON.stringify(ariaTree, null, 2),
    message: () => result.received,
    pass: result.matches,
    actual: result.received,
    log: result.log,
    timeout: result.timedOut ? timeout : undefined,
  };
}

function jsxToAriaTree(element: JSX.Element | string): AriaTemplateNode | AriaTemplateString {
  if (typeof element === 'string')
    return { kind: 'string', chunks: [element] };
  const children = element.props.children || [];
  const role = typeof element.type === 'function' ? element.type().role : '' as string;
  if (role === 'regex')
    return { kind: 'string', chunks: [element.props.regex] };

  const name = element.props.name || undefined;
  const ariaNode: AriaTemplateNode = { kind: 'node', role, name };
  if (Array.isArray(children)) {
    ariaNode.children = [];
    for (const child of children)
      ariaNode.children.push(jsxToAriaTree(child));
  } else {
    ariaNode.children = [jsxToAriaTree(children)];
  }
  return ariaNode;
}

function normalizeStringChildren(rootA11yNode: AriaTemplateNode) {
  const flushChildren = (buffer: AriaTemplateString, normalizedChildren: (AriaTemplateNode | AriaTemplateString)[]) => {
    if (!buffer.chunks.length)
      return;
    normalizedChildren.push({ kind: 'string', chunks: buffer.chunks.slice() });
    buffer.chunks.length = 0;
  };

  const visit = (ariaNode: AriaTemplateNode) => {
    const normalizedChildren: (AriaTemplateNode | AriaTemplateString)[] = [];
    const buffer: AriaTemplateString = { kind: 'string', chunks: [] };
    for (const child of ariaNode.children || []) {
      if (child.kind === 'string') {
        buffer.chunks.push(...child.chunks);
      } else {
        flushChildren(buffer, normalizedChildren);
        visit(child);
        normalizedChildren.push(child);
      }
    }
    flushChildren(buffer, normalizedChildren);
    ariaNode.children = normalizedChildren.length ? normalizedChildren : undefined;
  };
  visit(rootA11yNode);
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

export const roleFactory: any = {
  match: (regex: RegExp) => ({ type: () => ({ role: 'regex' }), props: { regex } })
};

for (const r of allRoles)
  roleFactory[r] = () => ({ role: r } as any);
