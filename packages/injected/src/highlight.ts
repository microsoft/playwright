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


type Rect = { x: number, y: number, width: number, height: number };

type RenderedHighlightEntry = {
  targetElement?: Element,
  color: string,
  borderColor?: string,
  fadeDuration?: number,
  highlightElement: HTMLElement,
  tooltipElement?: HTMLElement,
  box?: DOMRect,
  tooltipTop?: number,
  tooltipLeft?: number,
  tooltipText?: string,
  cssStyle?: string,
};

export type HighlightEntry = {
  element?: Element,
  box?: Rect,
  color: string,
  borderColor?: string,
  fadeDuration?: number,
  tooltipText?: string,
  cssStyle?: string,
};

export class Highlight {
  private _glassPaneElement: HTMLElement;
  private _glassPaneShadow: ShadowRoot;
  private _renderedEntries: RenderedHighlightEntry[] = [];
  private _actionPointElement: HTMLElement;
  private _titleElement: HTMLElement;
  private _userOverlayContainer: HTMLElement;
  private _userOverlays = new Map<string, HTMLElement>();
  private _userOverlayHidden = false;
  private _isUnderTest: boolean;
  private _injectedScript: InjectedScript;
  private _rafRequest: number | undefined;
  private _language: Language = 'javascript';

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;
    const document = injectedScript.document;
    this._isUnderTest = injectedScript.isUnderTest;
    this._glassPaneElement = document.createElement('x-pw-glass');
    this._glassPaneElement.setAttribute('popover', 'manual');
    this._glassPaneElement.style.inset = '0';
    this._glassPaneElement.style.width = '100%';
    this._glassPaneElement.style.height = '100%';
    this._glassPaneElement.style.maxWidth = 'none';
    this._glassPaneElement.style.maxHeight = 'none';
    this._glassPaneElement.style.padding = '0';
    this._glassPaneElement.style.margin = '0';
    this._glassPaneElement.style.border = 'none';
    this._glassPaneElement.style.overflow = 'visible';
    this._glassPaneElement.style.pointerEvents = 'none';
    this._glassPaneElement.style.display = 'flex';
    this._glassPaneElement.style.backgroundColor = 'transparent';
    this._actionPointElement = document.createElement('x-pw-action-point');
    this._actionPointElement.setAttribute('hidden', 'true');
    this._titleElement = document.createElement('x-pw-title');
    this._titleElement.setAttribute('hidden', 'true');
    this._userOverlayContainer = document.createElement('x-pw-user-overlays');
    this._userOverlayContainer.setAttribute('hidden', 'true');
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
    this._glassPaneShadow.appendChild(this._titleElement);
    this._glassPaneShadow.appendChild(this._userOverlayContainer);
  }

  install() {
    // NOTE: document.documentElement can be null: https://github.com/microsoft/TypeScript/issues/50078
    if (!this._injectedScript.document.documentElement)
      return;
    if (!this._injectedScript.document.documentElement.contains(this._glassPaneElement) || this._glassPaneElement.nextElementSibling)
      this._injectedScript.document.documentElement.appendChild(this._glassPaneElement);
    this._bringToFront();
  }

  private _bringToFront() {
    this._glassPaneElement.hidePopover();
    this._glassPaneElement.showPopover();
  }

  setLanguage(language: Language) {
    this._language = language;
  }

  runHighlightOnRaf(selector: ParsedSelector) {
    if (this._rafRequest)
      this._injectedScript.utils.builtins.cancelAnimationFrame(this._rafRequest);
    const elements = this._injectedScript.querySelectorAll(selector, this._injectedScript.document.documentElement);
    const locator = asLocator(this._language, stringifySelector(selector));
    const color = elements.length > 1 ? '#f6b26b7f' : '#6fa8dc7f';
    this.updateHighlight(elements.map((element, index) => {
      const suffix = elements.length > 1 ? ` [${index + 1} of ${elements.length}]` : '';
      return { element, color, tooltipText: locator + suffix };
    }));
    this._rafRequest = this._injectedScript.utils.builtins.requestAnimationFrame(() => this.runHighlightOnRaf(selector));
  }

  uninstall() {
    if (this._rafRequest)
      this._injectedScript.utils.builtins.cancelAnimationFrame(this._rafRequest);
    this._glassPaneElement.remove();
  }

  showActionPoint(x: number, y: number, fadeDuration?: number) {
    this._actionPointElement.style.top = y + 'px';
    this._actionPointElement.style.left = x + 'px';
    this._actionPointElement.hidden = false;
    if (fadeDuration)
      this._actionPointElement.style.animation = `pw-fade-out ${fadeDuration}ms ease-out forwards`;
    else
      this._actionPointElement.style.animation = '';
  }

  hideActionPoint() {
    this._actionPointElement.hidden = true;
  }

  showActionTitle(text: string, fadeDuration: number, position?: string, fontSize?: number) {
    this._titleElement.textContent = text;
    this._titleElement.hidden = false;
    if (fadeDuration) {
      const fadeTime = fadeDuration / 4;
      this._titleElement.style.animation = `pw-fade-out ${fadeTime}ms ease-out ${fadeDuration - fadeTime}ms forwards`;
    } else {
      this._titleElement.style.animation = '';
    }

    // Reset positioning
    this._titleElement.style.top = '';
    this._titleElement.style.bottom = '';
    this._titleElement.style.left = '';
    this._titleElement.style.right = '';
    this._titleElement.style.transform = '';

    switch (position) {
      case 'top-left':
        this._titleElement.style.top = '6px';
        this._titleElement.style.left = '6px';
        break;
      case 'top':
        this._titleElement.style.top = '6px';
        this._titleElement.style.left = '50%';
        this._titleElement.style.transform = 'translateX(-50%)';
        break;
      case 'bottom-left':
        this._titleElement.style.bottom = '6px';
        this._titleElement.style.left = '6px';
        break;
      case 'bottom':
        this._titleElement.style.bottom = '6px';
        this._titleElement.style.left = '50%';
        this._titleElement.style.transform = 'translateX(-50%)';
        break;
      case 'bottom-right':
        this._titleElement.style.bottom = '6px';
        this._titleElement.style.right = '6px';
        break;
      case 'top-right':
      default:
        this._titleElement.style.top = '6px';
        this._titleElement.style.right = '6px';
        break;
    }

    if (fontSize)
      this._titleElement.style.fontSize = fontSize + 'px';
  }

  hideActionTitle() {
    this._titleElement.hidden = true;
  }

  addUserOverlay(id: string, html: string) {
    const element = this._injectedScript.document.createElement('div');
    element.className = 'x-pw-user-overlay';
    element.innerHTML = html;
    // Mild sanitization for convenience.
    for (const script of element.querySelectorAll('script'))
      script.remove();
    for (const el of element.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('on'))
          el.removeAttribute(attr.name);
      }
    }
    this._userOverlays.set(id, element);
    this._userOverlayContainer.appendChild(element);
    this._userOverlayContainer.hidden = this._userOverlayHidden;
    return id;
  }

  getUserOverlay(id: string): HTMLElement | undefined {
    return this._userOverlays.get(id);
  }

  removeUserOverlay(id: string) {
    const element = this._userOverlays.get(id);
    if (element) {
      element.remove();
      this._userOverlays.delete(id);
    }
    if (this._userOverlays.size === 0)
      this._userOverlayContainer.hidden = true;
  }

  setUserOverlaysVisible(visible: boolean) {
    this._userOverlayHidden = !visible;
    this._userOverlayContainer.hidden = !visible || this._userOverlays.size === 0;
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
      this._renderedEntries.push({ targetElement: entry.element, box: toDOMRect(entry.box), color: entry.color, borderColor: entry.borderColor, fadeDuration: entry.fadeDuration, cssStyle: entry.cssStyle, tooltipElement, highlightElement });
    }

    // 2. Trigger layout while positioning tooltips and computing bounding boxes.
    for (const entry of this._renderedEntries) {
      if (!entry.box && !entry.targetElement)
        continue;
      entry.box = entry.box || entry.targetElement!.getBoundingClientRect();
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
      if (entry.borderColor)
        entry.highlightElement.style.border = '2px solid ' + entry.borderColor;
      if (entry.fadeDuration)
        entry.highlightElement.style.animation = `pw-fade-out ${entry.fadeDuration}ms ease-out forwards`;
      if (entry.cssStyle)
        entry.highlightElement.style.cssText += ';' + entry.cssStyle;

      if (this._isUnderTest)
        console.error('Highlight box for test: ' + JSON.stringify({ x: box.x, y: box.y, width: box.width, height: box.height })); // eslint-disable-line no-console
    }
  }

  firstBox(): DOMRect | undefined {
    return this._renderedEntries[0]?.box;
  }

  firstTooltipBox(): DOMRect | undefined {
    const entry = this._renderedEntries[0];
    if (!entry || !entry.tooltipElement || entry.tooltipLeft === undefined || entry.tooltipTop === undefined)
      return;
    return {
      x: entry.tooltipLeft,
      y: entry.tooltipTop,
      left: entry.tooltipLeft,
      top: entry.tooltipTop,
      width: entry.tooltipElement.offsetWidth,
      height: entry.tooltipElement.offsetHeight,
      bottom: entry.tooltipTop + entry.tooltipElement.offsetHeight,
      right: entry.tooltipLeft + entry.tooltipElement.offsetWidth,
      toJSON: () => {},
    };
  }

  // Note: there is a copy of this method in dialog.tsx. Please fix bugs in both places.
  tooltipPosition(box: DOMRect, tooltipElement: HTMLElement) {
    const tooltipWidth = tooltipElement.offsetWidth;
    const tooltipHeight = tooltipElement.offsetHeight;
    const totalWidth = this._glassPaneElement.offsetWidth;
    const totalHeight = this._glassPaneElement.offsetHeight;

    let anchorLeft = Math.max(5, box.left);
    if (anchorLeft + tooltipWidth > totalWidth - 5)
      anchorLeft = totalWidth - tooltipWidth - 5;
    let anchorTop = Math.max(0, box.bottom) + 5;
    if (anchorTop + tooltipHeight > totalHeight - 5) {
      // If can't fit below, either position above...
      if (Math.max(0, box.top) > tooltipHeight + 5) {
        anchorTop = Math.max(0, box.top) - tooltipHeight - 5;
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
      const box = entries[i].box ? toDOMRect(entries[i].box!) : entries[i].element!.getBoundingClientRect();
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

  onGlassPaneClick(handler: (event: MouseEvent) => void) {
    this._glassPaneElement.style.pointerEvents = 'auto';
    this._glassPaneElement.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    this._glassPaneElement.addEventListener('click', handler);
  }

  offGlassPaneClick(handler: (event: MouseEvent) => void) {
    this._glassPaneElement.style.pointerEvents = 'none';
    this._glassPaneElement.style.backgroundColor = 'transparent';
    this._glassPaneElement.removeEventListener('click', handler);
  }
}

function toDOMRect(box: Rect): DOMRect;
function toDOMRect(box: Rect | undefined): DOMRect | undefined;
function toDOMRect(box: Rect | undefined): DOMRect | undefined {
  if (!box)
    return undefined;
  return new DOMRect(box.x, box.y, box.width, box.height);
}
