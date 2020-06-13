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

import type * as actions from '../recorderActions';
import InjectedScript from '../../injected/injectedScript';
import { parseSelector } from '../../common/selectorParser';

declare global {
  interface Window {
    recordPlaywrightAction: (action: actions.Action) => void;
  }
}

export class Recorder {
  private _injectedScript: InjectedScript;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;

    document.addEventListener('click', event => this._onClick(event), true);
    document.addEventListener('input', event => this._onInput(event), true);
    document.addEventListener('keydown', event => this._onKeyDown(event), true);
  }

  private _onClick(event: MouseEvent) {
    const selector = this._buildSelector(event.target as Element);
    if ((event.target as Element).nodeName === 'SELECT')
      return;
    window.recordPlaywrightAction({
      name: 'click',
      selector,
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  private _onInput(event: Event) {
    const selector = this._buildSelector(event.target as Element);
    if ((event.target as Element).nodeName === 'INPUT') {
      const inputElement = event.target as HTMLInputElement;
      if ((inputElement.type || '').toLowerCase() === 'checkbox') {
        window.recordPlaywrightAction({
          name: inputElement.checked ? 'check' : 'uncheck',
          selector,
          signals: [],
        });
      } else {
        window.recordPlaywrightAction({
          name: 'fill',
          selector,
          signals: [],
          text: (event.target! as HTMLInputElement).value,
        });
      }
    }
    if ((event.target as Element).nodeName === 'SELECT') {
      const selectElement = event.target as HTMLSelectElement;
      window.recordPlaywrightAction({
        name: 'select',
        selector,
        options: [...selectElement.selectedOptions].map(option => option.value),
        signals: []
      });
    }
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab' && event.key !== 'Enter' && event.key !== 'Escape')
      return;
    const selector = this._buildSelector(event.target as Element);
    window.recordPlaywrightAction({
      name: 'press',
      selector,
      signals: [],
      key: event.key,
      modifiers: modifiersForEvent(event),
    });
  }

  private _buildSelector(targetElement: Element): string {
    const path: string[] = [];
    const root = document.documentElement;
    for (let element: Element | null = targetElement; element && element !== root; element = element.parentElement) {
      const selector = this._buildSelectorCandidate(element);
      if (selector)
        path.unshift(selector.selector);

      const fullSelector = path.join(' ');
      if (selector && selector.final)
        return fullSelector;
      if (targetElement === this._injectedScript.querySelector(parseSelector(fullSelector), root))
        return fullSelector;
    }
    return '<selector>';
  }

  private _buildSelectorCandidate(element: Element): { final: boolean, selector: string } | null {
    for (const attribute of ['data-testid', 'data-test-id', 'data-test']) {
      if (element.hasAttribute(attribute))
        return { final: true, selector: `${element.nodeName.toLocaleLowerCase()}[${attribute}=${element.getAttribute(attribute)}]` };
    }
    for (const attribute of ['aria-label']) {
      if (element.hasAttribute(attribute))
        return { final: false, selector: `${element.nodeName.toLocaleLowerCase()}[${attribute}=${element.getAttribute(attribute)}]` };
    }
    if (element.nodeName === 'INPUT') {
      if (element.hasAttribute('name'))
        return { final: false, selector: `input[name=${element.getAttribute('name')}]` };
      if (element.hasAttribute('type'))
        return { final: false, selector: `input[type=${element.getAttribute('type')}]` };
    } else if (element.nodeName === 'IMG') {
      if (element.hasAttribute('alt'))
        return { final: false, selector: `img[alt="${element.getAttribute('alt')}"]` };
    }
    const textSelector = textSelectorForElement(element);
    if (textSelector)
      return { final: false, selector: textSelector };

    // Depreoritize id, but still use it as a last resort.
    if (element.hasAttribute('id'))
      return { final: true, selector: `${element.nodeName.toLocaleLowerCase()}[id=${element.getAttribute('id')}]` };

    return null;
  }
}

function textSelectorForElement(node: Node): string | null {
  let needsTrim = false;
  let onlyText: string | null = null;
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE)
      continue;
    if (child.textContent && child.textContent.trim()) {
      if (onlyText)
        return null;
      onlyText = child.textContent.trim();
      needsTrim = child.textContent !== child.textContent.trim();
    } else {
      needsTrim = true;
    }
  }
  if (!onlyText)
    return null;
  return needsTrim ? `text=/\\s*${escapeForRegex(onlyText)}\\s*/` : `text="${onlyText}"`;
}

function modifiersForEvent(event: MouseEvent | KeyboardEvent): number {
  return (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0);
}

function buttonForEvent(event: MouseEvent): 'left' | 'middle' | 'right' {
  switch (event.which) {
    case 1: return 'left';
    case 2: return 'middle';
    case 3: return 'right';
  }
  return 'left';
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
