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

import { Writable } from 'stream';
import { BrowserContextBase } from '../browserContext';
import * as dom from '../dom';
import { Events } from '../events';
import * as frames from '../frames';
import { Page } from '../page';
import * as actions from './recorderActions';
import { TerminalOutput } from './terminalOutput';

export class RecorderController {
  private _output: TerminalOutput;
  private _performingAction = false;
  private _pageAliases = new Map<Page, string>();
  private _lastPopupOrdinal = 0;

  constructor(context: BrowserContextBase, output: Writable) {
    this._output = new TerminalOutput(output || process.stdout);
    context.on(Events.BrowserContext.Page, (page: Page) => {
      // First page is called page, others are called popup1, popup2, etc.
      const pageName = this._pageAliases.size ? 'popup' + ++this._lastPopupOrdinal : 'page';
      this._pageAliases.set(page, pageName);
      page.on(Events.Page.Close, () => this._pageAliases.delete(page));

      // Input actions that potentially lead to navigation are intercepted on the page and are
      // performed by the Playwright.
      page.exposeBinding('performPlaywrightAction',
          (source, action: actions.Action) => this._performAction(source.frame, action)).catch(e => {});

      // Other non-essential actions are simply being recorded.
      page.exposeBinding('recordPlaywrightAction',
          (source, action: actions.Action) => this._recordAction(source.frame, action)).catch(e => {});

      page.on(Events.Page.FrameNavigated, (frame: frames.Frame) => this._onFrameNavigated(frame));
      page.on(Events.Page.Popup, (popup: Page) => this._onPopup(page, popup));
    });
  }

  private async _performAction(frame: frames.Frame, action: actions.Action) {
    this._performingAction = true;
    this._recordAction(frame, action);
    if (action.name === 'click') {
      const { options } = toClickOptions(action);
      await frame.click(action.selector, options);
    }
    if (action.name === 'press') {
      const modifiers = toModifiers(action.modifiers);
      const shortcut = [...modifiers, action.key].join('+');
      await frame.press(action.selector, shortcut);
    }
    if (action.name === 'check')
      await frame.check(action.selector);
    if (action.name === 'uncheck')
      await frame.uncheck(action.selector);
    if (action.name === 'select')
      await frame.selectOption(action.selector, action.options);
    this._performingAction = false;
    setTimeout(() => action.committed = true, 5000);
  }

  private async _recordAction(frame: frames.Frame, action: actions.Action) {
    this._output.addAction(this._pageAliases.get(frame._page)!, frame, action);
  }

  private _onFrameNavigated(frame: frames.Frame) {
    if (frame.parentFrame())
      return;
    const pageAlias = this._pageAliases.get(frame._page);
    const action = this._output.lastAction();
    // We only augment actions that have not been committed.
    if (action && !action.committed && action.name !== 'navigate') {
      // If we hit a navigation while action is executed, we assert it. Otherwise, we await it.
      this._output.signal(pageAlias!, frame, { name: 'navigation', url: frame.url(), type: this._performingAction ? 'assert' : 'await' });
    } else if (!action || action.committed) {
      // If navigation happens out of the blue, we just log it.
      this._output.addAction(
        pageAlias!, frame, {
          name: 'navigate',
          url: frame.url(),
          signals: [],
        });
    }
  }

  private _onPopup(page: Page, popup: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    const action = this._output.lastAction();
    // We only augment actions that have not been committed.
    if (action && !action.committed) {
      // If we hit a navigation while action is executed, we assert it. Otherwise, we await it.
      this._output.signal(pageAlias, page.mainFrame(), { name: 'popup', popupAlias });
    }
  }
}

export function toClickOptions(action: actions.ClickAction): { method: 'click' | 'dblclick', options: dom.ClickOptions } {
  let method: 'click' | 'dblclick' = 'click';
  if (action.clickCount === 2)
    method = 'dblclick';
  const modifiers = toModifiers(action.modifiers);
  const options: dom.ClickOptions = {};
  if (action.button !== 'left')
    options.button = action.button;
  if (modifiers.length)
    options.modifiers = modifiers;
  if (action.clickCount > 2)
    options.clickCount = action.clickCount;
  return { method, options };
}

export function toModifiers(modifiers: number): ('Alt' | 'Control' | 'Meta' | 'Shift')[] {
  const result: ('Alt' | 'Control' | 'Meta' | 'Shift')[] = [];
  if (modifiers & 1)
    result.push('Alt');
  if (modifiers & 2)
    result.push('Control');
  if (modifiers & 4)
    result.push('Meta');
  if (modifiers & 8)
    result.push('Shift');
  return result;
}
