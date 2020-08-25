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

import { ParsedSelector, parseSelector } from '../../common/selectorParser';
import type InjectedScript from '../../injected/injectedScript';
import { html } from './html';

export class ConsoleAPI {
  private _injectedScript: InjectedScript;
  private _highlightContainer: Element;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
    this._highlightContainer = html`<div style="position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; z-index: 10000;"></div>`;
    (window as any).playwright = {
      $: (selector: string) => this._querySelector(selector),
      $$: (selector: string) => this._querySelectorAll(selector),
      inspect: (selector: string) => this._inspect(selector),
      clear: () => this._clearHighlight()
    };
  }

  private _checkSelector(parsed: ParsedSelector) {
    for (const {name} of parsed.parts) {
      if (!this._injectedScript.engines.has(name))
        throw new Error(`Unknown engine "${name}"`);
    }
  }

  private _highlightElements(elements: Element[] = [], target?: Element) {
    const scrollLeft = document.scrollingElement ? document.scrollingElement.scrollLeft : 0;
    const scrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    this._highlightContainer.textContent = '';
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const highlight = html`<div style="position: absolute; pointer-events: none; border-radius: 3px"></div>`;
      highlight.style.left = (rect.left + scrollLeft) + 'px';
      highlight.style.top = (rect.top + scrollTop) + 'px';
      highlight.style.height = rect.height + 'px';
      highlight.style.width = rect.width + 'px';
      if (element === target) {
        highlight.style.background = 'hsla(30, 97%, 37%, 0.3)';
        highlight.style.border = '3px solid hsla(30, 97%, 37%, 0.6)';
      } else {
        highlight.style.background = 'hsla(120, 100%, 37%, 0.3)';
        highlight.style.border = '3px solid hsla(120, 100%, 37%, 0.8)';
      }
      this._highlightContainer.appendChild(highlight);
    }
    document.body.appendChild(this._highlightContainer);
  }

  _querySelector(selector: string): (Element | undefined) {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.query('Playwright >> selector').`);
    const parsed = parseSelector(selector);
    this._checkSelector(parsed);
    const elements = this._injectedScript.querySelectorAll(parsed, document);
    this._highlightElements(elements, elements[0]);
    return elements[0];
  }

  _querySelectorAll(selector: string): Element[] {
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.$$('Playwright >> selector').`);
    const parsed = parseSelector(selector);
    this._checkSelector(parsed);
    const elements = this._injectedScript.querySelectorAll(parsed, document);
    this._highlightElements(elements);
    return elements;
  }

  _inspect(selector: string) {
    if (typeof (window as any).inspect !== 'function')
      return;
    if (typeof selector !== 'string')
      throw new Error(`Usage: playwright.inspect('Playwright >> selector').`);
    this._highlightElements();
    (window as any).inspect(this._querySelector(selector));
  }

  _clearHighlight() {
    this._highlightContainer.remove();
  }
}
