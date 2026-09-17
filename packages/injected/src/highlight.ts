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
  tooltipText?: string,
  cssStyle?: string,
};

export class Highlight {
  private _glassPaneElement: HTMLElement;
  private _glassPaneShadow: ShadowRoot;
  private _renderedEntries: RenderedHighlightEntry[] = [];
  private _actionPointElement: HTMLElement | undefined;
  private _actionCursorElement: HTMLElement;
  private _actionCursorAnimation: Animation | undefined;
  private _screencastDecorations: HTMLElement[] = [];
  private _titleElement: HTMLElement;
  private _userOverlayContainer: HTMLElement;
  private _userOverlays = new Map<string, HTMLElement>();
  private _userOverlayHidden = false;
  private _userOverlayTimer: number | undefined;
  private _isUnderTest: boolean;
  private _injectedScript: InjectedScript;
  private _rafRequest: number | undefined;
  private _language: Language = 'javascript';
  private _elementHighlights: { selector: ParsedSelector, cssStyle?: string }[] = [];

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
    this._actionCursorElement = document.createElement('x-pw-action-cursor');
    this._actionCursorElement.style.visibility = 'hidden';
    this._actionCursorElement.appendChild(this._createCursorSvg(document));
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
    this._glassPaneShadow.appendChild(this._actionCursorElement);
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

  setElementHighlights(highlights: { selector: ParsedSelector, cssStyle?: string }[]) {
    const hadHighlights = this._elementHighlights.length > 0;
    this._elementHighlights = highlights;
    if (this._elementHighlights.length) {
      this._ensureElementHighlightRaf();
    } else if (hadHighlights) {
      if (this._rafRequest) {
        this._injectedScript.utils.builtins.cancelAnimationFrame(this._rafRequest);
        this._rafRequest = undefined;
      }
      this.clearHighlight();
    }
  }

  private _ensureElementHighlightRaf() {
    if (this._rafRequest)
      return;
    const tick = () => {
      const entries: HighlightEntry[] = [];
      const glassPanes = [...this._injectedScript.document.querySelectorAll('x-pw-glass')];
      for (const { selector, cssStyle } of this._elementHighlights) {
        let elements: Element[] = [];
        try {
          elements = this._injectedScript.querySelectorAll(selector, this._injectedScript.document.documentElement);
        } catch {
        }
        // Do not accidentally match our own highlight.
        elements = elements.filter(element => !glassPanes.some(pane => this._injectedScript.utils.isInsideScope(pane, element)));
        // There is no locator representation for the aria template, skip the tooltip.
        const locator = selector.parts.some(part => part.name === 'aria-template') ? undefined : asLocator(this._language, stringifySelector(selector));
        const color = elements.length > 1 ? '#f6b26b7f' : '#6fa8dc7f';
        for (let i = 0; i < elements.length; ++i) {
          const suffix = elements.length > 1 ? ` [${i + 1} of ${elements.length}]` : '';
          entries.push({ element: elements[i], color, tooltipText: locator === undefined ? undefined : locator + suffix, cssStyle });
        }
      }
      this.updateHighlight(entries);
      this._rafRequest = this._injectedScript.utils.builtins.requestAnimationFrame(tick);
    };
    this._rafRequest = this._injectedScript.utils.builtins.requestAnimationFrame(tick);
  }

  uninstall() {
    if (this._rafRequest) {
      this._injectedScript.utils.builtins.cancelAnimationFrame(this._rafRequest);
      this._rafRequest = undefined;
    }
    this._elementHighlights = [];
    this._clearUserOverlayTimer();
    this._glassPaneElement.remove();
  }

  showActionPoint(x: number, y: number) {
    if (!this._actionPointElement) {
      this._actionPointElement = this._injectedScript.document.createElement('x-pw-action-point');
      this._glassPaneShadow.appendChild(this._actionPointElement);
    }
    this._actionPointElement.style.top = y + 'px';
    this._actionPointElement.style.left = x + 'px';
    this._actionPointElement.hidden = false;
  }

  hideActionPoint() {
    if (this._actionPointElement)
      this._actionPointElement.hidden = true;
  }

  showScreencastHighlight(box: Rect, style: string, fadeDuration: number) {
    const element = this._createScreencastDecoration('x-pw-screencast-highlight', style, fadeDuration);
    element.style.left = box.x + 'px';
    element.style.top = box.y + 'px';
    element.style.width = box.width + 'px';
    element.style.height = box.height + 'px';
  }

  showScreencastPoint(x: number, y: number, style: string, fadeDuration: number) {
    const element = this._createScreencastDecoration('x-pw-screencast-point', style, fadeDuration);
    element.style.left = x + 'px';
    element.style.top = y + 'px';
  }

  hideScreencastDecorations() {
    for (const element of this._screencastDecorations)
      element.remove();
    this._screencastDecorations = [];
  }

  private _createScreencastDecoration(name: string, style: string, fadeDuration: number): HTMLElement {
    const element = this._injectedScript.document.createElement(name);
    // User style goes first so that the geometry assigned by the caller wins.
    element.style.cssText = style;
    if (fadeDuration)
      element.style.setProperty('--pw-fade-duration', fadeDuration + 'ms');
    this._glassPaneShadow.appendChild(element);
    this._screencastDecorations.push(element);
    return element;
  }

  moveActionCursor(x: number, y: number, fadeDuration?: number) {
    const element = this._actionCursorElement;
    // Start where the cursor is rendered, it might be in the middle of the previous move.
    const from = element.getBoundingClientRect();
    const wasVisible = element.style.visibility === 'visible';
    this._actionCursorAnimation?.cancel();
    this._actionCursorAnimation = undefined;
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.visibility = 'visible';
    const dx = from.left - x;
    const dy = from.top - y;
    if (!wasVisible || !fadeDuration || Math.hypot(dx, dy) < 1)
      return;
    const duration = Math.max(80, Math.min(fadeDuration * 0.6, 400));
    // Start slow, speed up in the middle and land gently.
    this._actionCursorAnimation = element.animate(cursorPathKeyframes(dx, dy, x + y + dx + dy), { duration, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' });
  }

  restoreActionCursor(x: number, y: number) {
    if (this._actionCursorElement.style.visibility !== 'visible')
      this.moveActionCursor(x, y);
  }

  hideActionCursor() {
    this._actionCursorElement.style.visibility = 'hidden';
  }

  private _createCursorSvg(document: Document): SVGSVGElement {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    // macOS-style arrow with the tip at the origin, the border is drawn outside of the fill.
    svg.setAttribute('viewBox', '0 0 12 18');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', 'M0 0 L0 15.8 L3.9 12.4 L6.6 18.6 L8.9 17.6 L6.2 11.4 L11.2 11.4 Z');
    path.setAttribute('fill', 'black');
    path.setAttribute('stroke', 'white');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('paint-order', 'stroke');
    svg.appendChild(path);
    return svg;
  }

  showActionTitle(text: string, fadeDuration: number, position?: string, style?: string) {
    this._titleElement.textContent = text;
    this._titleElement.hidden = false;
    // User style goes first so that the position assigned below wins.
    this._titleElement.style.cssText = style ?? '';
    if (fadeDuration) {
      const fadeTime = fadeDuration / 4;
      this._titleElement.style.setProperty('--pw-fade-duration', fadeTime + 'ms');
      this._titleElement.style.setProperty('--pw-fade-delay', (fadeDuration - fadeTime) + 'ms');
    }

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
    this._ensureUserOverlayTimer();
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
    if (this._userOverlays.size === 0) {
      this._userOverlayContainer.hidden = true;
      this._clearUserOverlayTimer();
    }
  }

  // Elements that enter the top layer later paint above the glass pane, so keep re-promoting it while overlays are showing.
  private _ensureUserOverlayTimer() {
    if (this._userOverlayTimer !== undefined)
      return;
    const tick = () => {
      this.install();
      this._userOverlayTimer = this._injectedScript.utils.builtins.setTimeout(tick, 500);
    };
    this._userOverlayTimer = this._injectedScript.utils.builtins.setTimeout(tick, 500);
  }

  private _clearUserOverlayTimer() {
    if (this._userOverlayTimer === undefined)
      return;
    this._injectedScript.utils.builtins.clearTimeout(this._userOverlayTimer);
    this._userOverlayTimer = undefined;
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

  addMaskedElements(elements: Element[], color: string) {
    const existingEntries = this._renderedEntries.map(e => ({ element: e.targetElement, color: e.color }));
    const newEntries = elements.map(element => ({ element, color }));
    this.updateHighlight([...existingEntries, ...newEntries]);
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
      this._renderedEntries.push({ targetElement: entry.element, box: toDOMRect(entry.box), color: entry.color, cssStyle: entry.cssStyle, tooltipElement, highlightElement });
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
      if (entries[i].cssStyle !== this._renderedEntries[i].cssStyle)
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

// Keyframes that bring the cursor from (dx, dy) relative to its destination to the destination.
// The path bows to one side, more at the start than at the end, the way a hand moves a mouse.
function cursorPathKeyframes(dx: number, dy: number, seed: number): Keyframe[] {
  const random = (salt: number) => {
    const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  const distance = Math.hypot(dx, dy);
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const side = random(1) < 0.5 ? -1 : 1;
  const startBow = side * distance * (0.03 + 0.03 * random(2));
  const endBow = side * distance * (0.01 + 0.02 * random(3));
  // Control points at one and two thirds of the way.
  const c1x = dx * 2 / 3 + normalX * startBow;
  const c1y = dy * 2 / 3 + normalY * startBow;
  const c2x = dx / 3 + normalX * endBow;
  const c2y = dy / 3 + normalY * endBow;
  const keyframes: Keyframe[] = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const px = u * u * u * dx + 3 * u * u * t * c1x + 3 * u * t * t * c2x;
    const py = u * u * u * dy + 3 * u * u * t * c1y + 3 * u * t * t * c2y;
    keyframes.push({ transform: `translate(${px}px, ${py}px)` });
  }
  return keyframes;
}

function toDOMRect(box: Rect): DOMRect;
function toDOMRect(box: Rect | undefined): DOMRect | undefined;
function toDOMRect(box: Rect | undefined): DOMRect | undefined {
  if (!box)
    return undefined;
  return new DOMRect(box.x, box.y, box.width, box.height);
}
