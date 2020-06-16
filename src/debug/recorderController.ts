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

import * as actions from './recorderActions';
import * as frames from '../frames';
import { Page } from '../page';
import { Events } from '../events';
import { TerminalOutput } from './terminalOutput';
import * as dom from '../dom';

export class RecorderController {
  private _page: Page;
  private _output = new TerminalOutput();
  private _performingAction = false;

  constructor(page: Page) {
    this._page = page;

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    this._page.exposeBinding('performPlaywrightAction',
        (source, action: actions.Action) => this._performAction(source.frame, action));
    // Other non-essential actions are simply being recorded.
    this._page.exposeBinding('recordPlaywrightAction',
        (source, action: actions.Action) => this._recordAction(source.frame, action));

    this._page.on(Events.Page.FrameNavigated, (frame: frames.Frame) => this._onFrameNavigated(frame));
  }

  private async _performAction(frame: frames.Frame, action: actions.Action) {
    if (frame !== this._page.mainFrame())
      action.frameUrl = frame.url();
    this._performingAction = true;
    this._output.addAction(action);
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
    this._performingAction = false;
    setTimeout(() => action.committed = true, 2000);
  }

  private async _recordAction(frame: frames.Frame, action: actions.Action) {
    if (frame !== this._page.mainFrame())
      action.frameUrl = frame.url();
    this._output.addAction(action);
  }

  private _onFrameNavigated(frame: frames.Frame) {
    if (frame.parentFrame())
      return;
    const action = this._output.lastAction();
    // We only augment actions that have not been committed.
    if (action && !action.committed) {
      // If we hit a navigation while action is executed, we assert it. Otherwise, we await it.
      this._output.signal({ name: 'navigation', url: frame.url(), type: this._performingAction ? 'assert' : 'await' });
    } else {
      // If navigation happens out of the blue, we just log it.
      this._output.addAction({
        name: 'navigate',
        url: this._page.url(),
        signals: [],
      });
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
