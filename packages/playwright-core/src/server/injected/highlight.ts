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

export class Highlight {
  private _outerGlassPaneElement: HTMLElement;
  private _glassPaneShadow: ShadowRoot;
  private _innerGlassPaneElement: HTMLElement;
  private _highlightElements: HTMLElement[] = [];
  private _tooltipElement: HTMLElement;
  private _actionPointElement: HTMLElement;
  private _isUnderTest: boolean;

  constructor(isUnderTest: boolean) {
    this._isUnderTest = isUnderTest;
    this._outerGlassPaneElement = document.createElement('x-pw-glass');
    this._outerGlassPaneElement.style.position = 'fixed';
    this._outerGlassPaneElement.style.top = '0';
    this._outerGlassPaneElement.style.right = '0';
    this._outerGlassPaneElement.style.bottom = '0';
    this._outerGlassPaneElement.style.left = '0';
    this._outerGlassPaneElement.style.zIndex = '2147483647';
    this._outerGlassPaneElement.style.pointerEvents = 'none';
    this._outerGlassPaneElement.style.display = 'flex';

    this._tooltipElement = document.createElement('x-pw-tooltip');
    this._actionPointElement = document.createElement('x-pw-action-point');
    this._actionPointElement.setAttribute('hidden', 'true');

    this._innerGlassPaneElement = document.createElement('x-pw-glass-inner');
    this._innerGlassPaneElement.style.flex = 'auto';
    this._innerGlassPaneElement.appendChild(this._tooltipElement);

    // Use a closed shadow root to prevent selectors matching our internal previews.
    this._glassPaneShadow = this._outerGlassPaneElement.attachShadow({ mode: isUnderTest ? 'open' : 'closed' });
    this._glassPaneShadow.appendChild(this._innerGlassPaneElement);
    this._glassPaneShadow.appendChild(this._actionPointElement);
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        x-pw-tooltip {
          align-items: center;
          backdrop-filter: blur(5px);
          background-color: rgba(0, 0, 0, 0.7);
          border-radius: 2px;
          box-shadow: rgba(0, 0, 0, 0.1) 0px 3.6px 3.7px,
                      rgba(0, 0, 0, 0.15) 0px 12.1px 12.3px,
                      rgba(0, 0, 0, 0.1) 0px -2px 4px,
                      rgba(0, 0, 0, 0.15) 0px -12.1px 24px,
                      rgba(0, 0, 0, 0.25) 0px 54px 55px;
          color: rgb(204, 204, 204);
          display: none;
          font-family: 'Dank Mono', 'Operator Mono', Inconsolata, 'Fira Mono',
                      'SF Mono', Monaco, 'Droid Sans Mono', 'Source Code Pro', monospace;
          font-size: 12.8px;
          font-weight: normal;
          left: 0;
          line-height: 1.5;
          max-width: 600px;
          padding: 3.2px 5.12px 3.2px;
          position: absolute;
          top: 0;
        }
        x-pw-action-point {
          position: absolute;
          width: 20px;
          height: 20px;
          background: red;
          border-radius: 10px;
          pointer-events: none;
          margin: -10px 0 0 -10px;
          z-index: 2;
        }
        *[hidden] {
          display: none !important;
        }
    `;
    this._glassPaneShadow.appendChild(styleElement);
  }

  install() {
    document.documentElement.appendChild(this._outerGlassPaneElement);
  }

  uninstall() {
    this._outerGlassPaneElement.remove();
  }

  isInstalled(): boolean {
    return this._outerGlassPaneElement.parentElement === document.documentElement && !this._outerGlassPaneElement.nextElementSibling;
  }

  showActionPoint(x: number, y: number) {
    this._actionPointElement.style.top = y + 'px';
    this._actionPointElement.style.left = x + 'px';
    this._actionPointElement.hidden = false;
    if (this._isUnderTest)
      console.error('Action point for test: ' + JSON.stringify({ x, y })); // eslint-disable-line no-console
  }

  hideActionPoint() {
    this._actionPointElement.hidden = true;
  }

  updateHighlight(elements: Element[], selector: string, isRecording: boolean) {
    // Code below should trigger one layout and leave with the
    // destroyed layout.

    // Destroy the layout
    this._tooltipElement.textContent = selector;
    this._tooltipElement.style.top = '0';
    this._tooltipElement.style.left = '0';
    this._tooltipElement.style.display = 'flex';

    // Trigger layout.
    const boxes = elements.map(e => e.getBoundingClientRect());
    const tooltipWidth = this._tooltipElement.offsetWidth;
    const tooltipHeight = this._tooltipElement.offsetHeight;
    const totalWidth = this._innerGlassPaneElement.offsetWidth;
    const totalHeight = this._innerGlassPaneElement.offsetHeight;

    // Destroy the layout again.
    if (boxes.length) {
      const primaryBox = boxes[0];
      let anchorLeft = primaryBox.left;
      if (anchorLeft + tooltipWidth > totalWidth - 5)
        anchorLeft = totalWidth - tooltipWidth - 5;
      let anchorTop = primaryBox.bottom + 5;
      if (anchorTop + tooltipHeight > totalHeight - 5) {
        // If can't fit below, either position above...
        if (primaryBox.top > tooltipHeight + 5) {
          anchorTop = primaryBox.top - tooltipHeight - 5;
        } else {
          // Or on top in case of large element
          anchorTop = totalHeight - 5 - tooltipHeight;
        }
      }
      this._tooltipElement.style.top = anchorTop + 'px';
      this._tooltipElement.style.left = anchorLeft + 'px';
    } else {
      this._tooltipElement.style.display = 'none';
    }

    const pool = this._highlightElements;
    this._highlightElements = [];
    for (const box of boxes) {
      const highlightElement = pool.length ? pool.shift()! : this._createHighlightElement();
      const color = isRecording ? '#dc6f6f7f' : '#6fa8dc7f';
      highlightElement.style.backgroundColor = this._highlightElements.length ? '#f6b26b7f' : color;
      highlightElement.style.left = box.x + 'px';
      highlightElement.style.top = box.y + 'px';
      highlightElement.style.width = box.width + 'px';
      highlightElement.style.height = box.height + 'px';
      highlightElement.style.display = 'block';
      this._highlightElements.push(highlightElement);

      if (this._isUnderTest)
        console.error('Highlight box for test: ' + JSON.stringify({ x: box.x, y: box.y, width: box.width, height: box.height })); // eslint-disable-line no-console
    }

    for (const highlightElement of pool) {
      highlightElement.style.display = 'none';
      this._highlightElements.push(highlightElement);
    }
  }

  maskElements(elements: Element[]) {
    const boxes = elements.map(e => e.getBoundingClientRect());
    const pool = this._highlightElements;
    this._highlightElements = [];
    for (const box of boxes) {
      const highlightElement = pool.length ? pool.shift()! : this._createHighlightElement();
      highlightElement.style.backgroundColor = '#F0F';
      highlightElement.style.left = box.x + 'px';
      highlightElement.style.top = box.y + 'px';
      highlightElement.style.width = box.width + 'px';
      highlightElement.style.height = box.height + 'px';
      highlightElement.style.display = 'block';
      this._highlightElements.push(highlightElement);
    }

    for (const highlightElement of pool) {
      highlightElement.style.display = 'none';
      this._highlightElements.push(highlightElement);
    }
  }


  private _createHighlightElement(): HTMLElement {
    const highlightElement = document.createElement('x-pw-highlight');
    highlightElement.style.position = 'absolute';
    highlightElement.style.top = '0';
    highlightElement.style.left = '0';
    highlightElement.style.width = '0';
    highlightElement.style.height = '0';
    highlightElement.style.boxSizing = 'border-box';
    this._glassPaneShadow.appendChild(highlightElement);
    return highlightElement;
  }
}
