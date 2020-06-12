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

declare global {
  interface Window {
    recordPlaywrightAction?: (action: actions.Action) => void;
  }
}

export class Recorder {
  constructor() {
    document.addEventListener('click', event => this._onClick(event), true);
    document.addEventListener('input', event => this._onInput(event), true);
    document.addEventListener('keydown', event => this._onKeyDown(event), true);
  }

  private _onClick(event: MouseEvent) {
    if (!window.recordPlaywrightAction)
      return;
    const selector = this._buildSelector(event.target as Node);
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
    if (!window.recordPlaywrightAction)
      return;
    const selector = this._buildSelector(event.target as Node);
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
    if (!window.recordPlaywrightAction)
      return;
    if (event.key !== 'Tab' && event.key !== 'Enter' && event.key !== 'Escape')
      return;
    const selector = this._buildSelector(event.target as Node);
    window.recordPlaywrightAction({
      name: 'press',
      selector,
      signals: [],
      key: event.key,
      modifiers: modifiersForEvent(event),
    });
  }

  private _buildSelector(node: Node): string {
    const element = node as Element;
    for (const attribute of ['data-testid', 'aria-label', 'id', 'data-test-id', 'data-test']) {
      if (element.hasAttribute(attribute))
        return `[${attribute}=${element.getAttribute(attribute)}]`;
    }
    if (element.nodeName === 'INPUT') {
      if (element.hasAttribute('name'))
        return `[input name=${element.getAttribute('name')}]`;
      if (element.hasAttribute('type'))
        return `[input type=${element.getAttribute('type')}]`;
    }
    if (element.firstChild && element.firstChild === element.lastChild && element.firstChild.nodeType === Node.TEXT_NODE)
      return `text="${element.textContent}"`;
    return '<selector>';
  }
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
