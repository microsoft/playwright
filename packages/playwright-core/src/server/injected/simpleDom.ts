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

import type { InjectedScript } from './injectedScript';

export type SimpleDom = {
  markup: string;
  elements: Map<string, Element>;
};

export type SimpleDomNode = {
  dom: SimpleDom;
  id: string;
  tag: string;
};

export function generateSimpleDom(injectedScript: InjectedScript): SimpleDom {
  return generate(injectedScript).dom;
}

export function generateSimpleDomNode(injectedScript: InjectedScript, target: Element): SimpleDomNode {
  return generate(injectedScript, { target }).node!;
}

function generate(injectedScript: InjectedScript, options?: { target?: Element, generateIds?: boolean }): { dom: SimpleDom, node?: SimpleDomNode } {
  const normalizeWhitespace = (text: string) => text.replace(/[\s\n]+/g, match => match.includes('\n') ? '\n' : ' ');
  const tokens: string[] = [];
  const elements = new Map<string, Element>();
  let lastId = 0;
  let resultTarget: { tag: string, id: string } | undefined;
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push(node.nodeValue!);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE)
      return;

    const element = node as Element;
    if (element.nodeName === 'SCRIPT' || element.nodeName === 'STYLE' || element.nodeName === 'NOSCRIPT')
      return;

    const isElementVisible = injectedScript.utils.isElementVisible(element);
    const hasVisibleChildren = isElementVisible && element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });

    if (!hasVisibleChildren)
      return;

    if (!isElementVisible) {
      for (let child = element.firstChild; child; child = child.nextSibling)
        visit(child);
      return;
    }

    const role = injectedScript.utils.getAriaRole(element) as string;
    if (role && leafRoles.has(role)) {
      const structuralId = options?.generateIds ? String(++lastId) : undefined;
      if (structuralId)
        elements.set(structuralId, element);

      const tag = roleToTag(injectedScript, role, element);
      tokens.push(renderLeafTag(injectedScript, tag, structuralId));
      if (element === options?.target) {
        if (tag.attributes)
          delete tag.attributes.value;
        const tagNoValue = renderLeafTag(injectedScript, tag, structuralId);
        resultTarget = { tag: tagNoValue, id: structuralId! };
      }
      return;
    }

    let compositeTag: Tag | undefined;
    if (role) {
      compositeTag = roleToTag(injectedScript, role, element);
      tokens.push(renderOpeningTag(injectedScript, compositeTag));
    }

    for (let child = element.firstChild; child; child = child.nextSibling)
      visit(child);

    if (compositeTag)
      tokens.push(renderClosingTag(compositeTag));
  };
  injectedScript.utils.beginAriaCaches();
  try {
    visit(injectedScript.document.body);
  } finally {
    injectedScript.utils.endAriaCaches();
  }
  const dom = {
    markup: normalizeWhitespace(tokens.join(' ')),
    elements
  };

  if (options?.target && !resultTarget)
    throw new Error('Target element is not in the simple DOM');

  return { dom, node: resultTarget ? { dom, ...resultTarget } : undefined };
}

const leafRoles = new Set([
  'alert', 'blockquote', 'button', 'caption', 'checkbox', 'code', 'columnheader',
  'definition', 'deletion', 'emphasis', 'generic', 'heading', 'img', 'insertion',
  'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'none', 'option',
  'presentation', 'progressbar', 'radio', 'rowheader', 'scrollbar', 'searchbox', 'separator',
  'slider', 'spinbutton', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'term',
  'textbox', 'time', 'tooltip'
]);

type Tag = {
  tagName: string;
  content?: string;
  attributes?: Record<string, string>;
};

function roleToTag(injectedScript: InjectedScript, role: string, element: Element): Tag {
  const accessibleName = injectedScript.utils.getElementAccessibleName(element, false);
  let value = '';
  if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
    value = (element as HTMLInputElement | HTMLTextAreaElement).value;

  switch (role) {
    case 'article': return { tagName: 'ARTICLE' };
    case 'banner': return { tagName: 'HEADER' };
    case 'blockquote': return { tagName: 'BLOCKQUOTE' };
    case 'button': return { tagName: 'BUTTON', content: accessibleName };
    case 'caption': return { tagName: 'CAPTION' };
    case 'cell': return { tagName: 'TD' };
    case 'checkbox': {
      const attributes: Record<string, string> = { type: 'checkbox' };
      if (injectedScript.utils.getAriaChecked(element))
        attributes.checked = '';
      return { tagName: 'INPUT', attributes };
    }
    case 'code': return { tagName: 'CODE' };
    case 'columnheader': return { tagName: 'TH', attributes: { scope: 'col' } };
    case 'combobox': return { tagName: 'SELECT' };
    case 'complementary': return { tagName: 'ASIDE' };
    case 'contentinfo': return { tagName: 'FOOTER' };
    case 'definition': return { tagName: 'DD' };
    case 'dialog': return { tagName: 'DIALOG' };
    case 'document': return { tagName: 'HTML' };
    case 'emphasis': return { tagName: 'EM' };
    case 'figure': return { tagName: 'FIGURE' };
    case 'form': return { tagName: 'FORM' };
    case 'gridcell': return { tagName: 'TD' };
    case 'group': return { tagName: 'OPTGROUP' };
    case 'heading': {
      const level = injectedScript.utils.getAriaLevel(element);
      return { tagName: `H${level}`, content: element.textContent || '' };
    }
    case 'img': return { tagName: 'IMG', attributes: { alt: accessibleName } };
    case 'insertion': return { tagName: 'INS' };
    case 'link': return { tagName: 'A', content: accessibleName };
    case 'list': return { tagName: 'UL' };
    case 'listbox': return { tagName: 'SELECT', attributes: { 'multiple': '' } };
    case 'listitem': return { tagName: 'LI' };
    case 'main': return { tagName: 'MAIN' };
    case 'mark': return { tagName: 'MARK' };
    case 'math': return { tagName: 'MATH' };
    case 'meter': return { tagName: 'METER' };
    case 'navigation': return { tagName: 'NAV' };
    case 'option': return { tagName: 'OPTION', content: accessibleName };
    case 'paragraph': return { tagName: 'P', content: element.textContent || '' };
    case 'progressbar': return { tagName: 'PROGRESS' };
    case 'radio': {
      const attributes: Record<string, string> = { type: 'radio' };
      if (injectedScript.utils.getAriaChecked(element))
        attributes.checked = '';
      return { tagName: 'INPUT', attributes };
    }
    case 'region': return { tagName: 'SECTION' };
    case 'row': return { tagName: 'TR' };
    case 'rowgroup': return { tagName: 'TBODY' };
    case 'rowheader': return { tagName: 'TH', attributes: { scope: 'row' } };
    case 'searchbox': return { tagName: 'INPUT', attributes: { type: 'search' } };
    case 'separator': return { tagName: 'HR' };
    case 'slider': return { tagName: 'INPUT', attributes: { type: 'range' } };
    case 'spinbutton': return { tagName: 'INPUT', attributes: { type: 'number' } };
    case 'status': return { tagName: 'OUTPUT' };
    case 'strong': return { tagName: 'STRONG' };
    case 'submit': return { tagName: 'INPUT', attributes: { type: 'submit' } };
    case 'subscript': return { tagName: 'SUB' };
    case 'superscript': return { tagName: 'SUP' };
    case 'table': return { tagName: 'TABLE' };
    case 'term': return { tagName: 'DT' };
    case 'textbox': return { tagName: 'INPUT', attributes: { type: 'text', value } };
    case 'time': return { tagName: 'TIME' };
  }
  return { tagName: 'DIV', attributes: { role, 'aria-label': accessibleName } };
}

function renderOpeningTag(injectedScript: InjectedScript, tag: Tag) {
  const result: string[] = [];
  result.push(`<${tag.tagName.toLowerCase()}`);
  for (const [name, value] of Object.entries(tag.attributes || {})) {
    const valueText = value ? `="${injectedScript.utils.escapeHTMLAttribute(value)}"` : '';
    result.push(` ${name}${valueText}`);
  }
  result.push('>');
  return result.join('');
}

function renderClosingTag(tag: Tag) {
  return `</${tag.tagName.toLowerCase()}>`;
}

function renderLeafTag(injectedScript: InjectedScript, tag: Tag, id?: string) {
  if (id) {
    tag.attributes = tag.attributes || {};
    tag.attributes['id'] = id;
  }

  if (injectedScript.utils.autoClosingTags.has(tag.tagName))
    return renderOpeningTag(injectedScript, tag);

  return renderOpeningTag(injectedScript, tag) + (injectedScript.utils.escapeHTML(tag.content || '')) + renderClosingTag(tag);
}
