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

import { asLocator } from '@isomorphic/locatorGenerators';
import { stringifySelector } from '@isomorphic/selectorParser';

import highlightCSS from './highlight.css?inline';

import type { Language } from '@isomorphic/locatorGenerators';
import type { ParsedSelector } from '@isomorphic/selectorParser';
import type { InjectedScript } from './injectedScript';


type RenderedHighlightEntry = {
  targetElement: Element,
  color: string,
  highlightElement: HTMLElement,
  tooltipElement?: HTMLElement,
  box?: DOMRect,
  tooltipTop?: number,
  tooltipLeft?: number,
  tooltipText?: string,
};

export type HighlightEntry = {
  element: Element,
  color: string,
  tooltipText?: string,
};

export class Highlight {
  private _glassPaneElement: HTMLElement;
  private _glassPaneShadow: ShadowRoot;
  private _renderedEntries: RenderedHighlightEntry[] = [];
  private _actionPointElement: HTMLElement;
  private _isUnderTest: boolean;
  private _injectedScript: InjectedScript;
  private _rafRequest: number | undefined;
  private _language: Language = 'javascript';

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
    const document = injectedScript.document;
    this._isUnderTest = injectedScript.isUnderTest;
    this._glassPaneElement = document.createElement('x-pw-glass');
    this._glassPaneElement.style.position = 'fixed';
    this._glassPaneElement.style.top = '0';
    this._glassPaneElement.style.right = '0';
    this._glassPaneElement.style.bottom = '0';
    this._glassPaneElement.style.left = '0';
    this._glassPaneElement.style.zIndex = '2147483646';
    this._glassPaneElement.style.pointerEvents = 'none';
    this._glassPaneElement.style.display = 'flex';
    this._glassPaneElement.style.backgroundColor = 'transparent';
    for (const eventName of ['click', 'auxclick', 'dragstart', 'input', 'keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'mouseleave', 'focus', 'scroll']) {
      this._glassPaneElement.addEventListener(eventName, e => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
    }
    this._actionPointElement = document.createElement('x-pw-action-point');
    this._actionPointElement.setAttribute('hidden', 'true');
    this._glassPaneShadow = this._glassPaneElement.attachShadow({ mode: this._isUnderTest ? 'open' : 'closed' });
    // workaround for firefox: when taking screenshots, it complains adoptedStyleSheets.push
    // is not a function, so we fallback to style injection
    if (typeof this._glassPaneShadow.adoptedStyleSheets.push === 'function') {
      const sheet = new this._injectedScript.window.CSSStyleSheet();
      sheet.replaceSync(highlightCSS);
      this._glassPaneShadow.adoptedStyleSheets.push(sheet);
    } else {
      const styleElement = this._injectedScript.document.createElement('style');
      styleElement.textContent = highlightCSS;
      this._glassPaneShadow.appendChild(styleElement);
    }
    this._glassPaneShadow.appendChild(this._actionPointElement);
  }

  install() {
    // NOTE: document.documentElement can be null: https://github.com/microsoft/TypeScript/issues/50078
    if (this._injectedScript.document.documentElement && !this._injectedScript.document.documentElement.contains(this._glassPaneElement))
      this._injectedScript.document.documentElement.appendChild(this._glassPaneElement);
  }

  setLanguage(language: Language) {
    this._language = language;
  }

  runHighlightOnRaf(selector: ParsedSelector) {
    if (this._rafRequest)
      cancelAnimationFrame(this._rafRequest);
    const elements = this._injectedScript.querySelectorAll(selector, this._injectedScript.document.documentElement);
    const locator = asLocator(this._language, stringifySelector(selector));
    const color = elements.length > 1 ? '#f6b26b7f' : '#6fa8dc7f';
    this.updateHighlight(elements.map((element, index) => {
      const suffix = elements.length > 1 ? ` [${index + 1} of ${elements.length}]` : '';
      return { element, color, tooltipText: locator + suffix };
    }));
    this._rafRequest = requestAnimationFrame(() => this.runHighlightOnRaf(selector));
  }

  uninstall() {
    if (this._rafRequest)
      cancelAnimationFrame(this._rafRequest);
    this._glassPaneElement.remove();
  }

  showActionPoint(x: number, y: number) {
    this._actionPointElement.style.top = y + 'px';
    this._actionPointElement.style.left = x + 'px';
    this._actionPointElement.hidden = false;
  }

  hideActionPoint() {
    this._actionPointElement.hidden = true;
  }

  clearHighlight() {
    for (const entry of this._renderedEntries) {
      entry.highlightElement?.remove();
      entry.tooltipElement?.remove();
    }
    this._renderedEntries = [];
  }

  maskElements(elements: Element[], color: string) {
    this.updateHighlight(elements.map(element => ({ element, color })));
  }

  updateHighlight(entries: HighlightEntry[]) {
    // Code below should trigger one layout and leave with the
    // destroyed layout.

    if (this._highlightIsUpToDate(entries))
      return;

    // 1. Destroy the layout
    this.clearHighlight();

    for (const entry of entries) {
      const highlightElement = this._createHighlightElement();
      this._glassPaneShadow.appendChild(highlightElement);

      let tooltipElement;
      if (entry.tooltipText) {
        tooltipElement = this._injectedScript.document.createElement('x-pw-tooltip');
        this._glassPaneShadow.appendChild(tooltipElement);
        tooltipElement.style.top = '0';
        tooltipElement.style.left = '0';
        tooltipElement.style.display = 'flex';
        const lineElement = this._injectedScript.document.createElement('x-pw-tooltip-line');
        lineElement.textContent = entry.tooltipText;
        tooltipElement.appendChild(lineElement);
      }
      this._renderedEntries.push({ targetElement: entry.element, color: entry.color, tooltipElement, highlightElement });
    }

    // 2. Trigger layout while positioning tooltips and computing bounding boxes.
    for (const entry of this._renderedEntries) {
      entry.box = entry.targetElement.getBoundingClientRect();
      if (!entry.tooltipElement)
        continue;

      // Position tooltip, if any.
      const { anchorLeft, anchorTop } = this.tooltipPosition(entry.box, entry.tooltipElement);
      entry.tooltipTop = anchorTop;
      entry.tooltipLeft = anchorLeft;
    }

    // 3. Destroy the layout again.
    for (const entry of this._renderedEntries) {
      if (entry.tooltipElement) {
        entry.tooltipElement.style.top = entry.tooltipTop + 'px';
        entry.tooltipElement.style.left = entry.tooltipLeft + 'px';
      }
      const box = entry.box!;
      entry.highlightElement.style.backgroundColor = entry.color;
      entry.highlightElement.style.left = box.x + 'px';
      entry.highlightElement.style.top = box.y + 'px';
      entry.highlightElement.style.width = box.width + 'px';
      entry.highlightElement.style.height = box.height + 'px';
      entry.highlightElement.style.display = 'block';

      if (this._isUnderTest)
        console.error('Highlight box for test: ' + JSON.stringify({ x: box.x, y: box.y, width: box.width, height: box.height })); // eslint-disable-line no-console
    }
  }

  firstBox(): DOMRect | undefined {
    return this._renderedEntries[0]?.box;
  }

  tooltipPosition(box: DOMRect, tooltipElement: HTMLElement) {
    const tooltipWidth = tooltipElement.offsetWidth;
    const tooltipHeight = tooltipElement.offsetHeight;
    const totalWidth = this._glassPaneElement.offsetWidth;
    const totalHeight = this._glassPaneElement.offsetHeight;

    let anchorLeft = box.left;
    if (anchorLeft + tooltipWidth > totalWidth - 5)
      anchorLeft = totalWidth - tooltipWidth - 5;
    let anchorTop = box.bottom + 5;
    if (anchorTop + tooltipHeight > totalHeight - 5) {
      // If can't fit below, either position above...
      if (box.top > tooltipHeight + 5) {
        anchorTop = box.top - tooltipHeight - 5;
      } else {
        // Or on top in case of large element
        anchorTop = totalHeight - 5 - tooltipHeight;
      }
    }
    return { anchorLeft, anchorTop };
  }

  private _highlightIsUpToDate(entries: HighlightEntry[]): boolean {
    if (entries.length !== this._renderedEntries.length)
      return false;
    for (let i = 0; i < this._renderedEntries.length; ++i) {
      if (entries[i].element !== this._renderedEntries[i].targetElement)
        return false;
      if (entries[i].color !== this._renderedEntries[i].color)
        return false;
      const oldBox = this._renderedEntries[i].box;
      if (!oldBox)
        return false;
      const box = entries[i].element.getBoundingClientRect();
      if (box.top !== oldBox.top || box.right !== oldBox.right || box.bottom !== oldBox.bottom || box.left !== oldBox.left)
        return false;
    }
    return true;
  }

  private _createHighlightElement(): HTMLElement {
    return this._injectedScript.document.createElement('x-pw-highlight');
  }

  appendChild(element: Element) {
    this._glassPaneShadow.appendChild(element);
  }
}
