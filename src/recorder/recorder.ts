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

import * as frames from '../frames';
import { Page } from '../page';
import { Script } from './script';
import { Events } from '../events';
import * as actions from './actions';

declare global {
  interface Window {
    recordPlaywrightAction: (action: actions.Action) => void;
  }
}

export class Recorder {
  private _page: Page;
  private _script = new Script();

  constructor(page: Page) {
    this._page = page;
  }

  start() {
    this._script.addAction({
      name: 'navigate',
      url: this._page.url()
    });
    this._printScript();

    this._page.exposeBinding('recordPlaywrightAction', (source, action: actions.Action) => {
      this._script.addAction(action);
      this._printScript();
    });

    this._page.on(Events.Page.FrameNavigated, (frame: frames.Frame) => {
      if (frame.parentFrame())
        return;
      const action = this._script.lastAction();
      if (action) {
        action.signals = action.signals || [];
        action.signals.push({ name: 'navigation', url: frame.url() });
      }
      this._printScript();
    });

    const injectedScript = () => {
      if (document.readyState === 'complete')
        addListeners();
      else
        document.addEventListener('load', addListeners);

      function addListeners() {
        document.addEventListener('click', (event: MouseEvent) => {
          const selector = buildSelector(event.target as Node);
          if ((event.target as Element).nodeName === 'SELECT')
            return;
          window.recordPlaywrightAction({
            name: 'click',
            selector,
            button: buttonForEvent(event),
            modifiers: modifiersForEvent(event),
            clickCount: event.detail
          });
        }, true);
        document.addEventListener('input', (event: Event) => {
          const selector = buildSelector(event.target as Node);
          if ((event.target as Element).nodeName === 'INPUT') {
            const inputElement = event.target as HTMLInputElement;
            if ((inputElement.type || '').toLowerCase() === 'checkbox') {
              window.recordPlaywrightAction({
                name: inputElement.checked ? 'check' : 'uncheck',
                selector,
              });
            } else {
              window.recordPlaywrightAction({
                name: 'fill',
                selector,
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
            });
          }
        }, true);
        document.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key !== 'Tab' && event.key !== 'Enter' && event.key !== 'Escape')
            return;
          const selector = buildSelector(event.target as Node);
          window.recordPlaywrightAction({
            name: 'press',
            selector,
            key: event.key,
          });
        }, true);
      }

      function buildSelector(node: Node): string {
        const element = node as Element;
        for (const attribute of ['data-testid', 'aria-label', 'id', 'data-test-id', 'data-test']) {
          if (element.hasAttribute(attribute))
            return `[${attribute}=${element.getAttribute(attribute)}]`;
        }
        if (element.nodeName === 'INPUT')
          return `[input name=${element.getAttribute('name')}]`;
        return `text="${element.textContent}"`;
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
    };
    this._page.addInitScript(injectedScript);
    this._page.evaluate(injectedScript);
  }

  _printScript() {
    console.log('\x1Bc');  // eslint-disable-line no-console
    console.log(this._script.generate('chromium'));  // eslint-disable-line no-console
  }
}
