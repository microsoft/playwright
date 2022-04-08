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

import { EventEmitter } from 'events';
import type { BrowserContextOptions, LaunchOptions } from '../../..';
import type { Frame } from '../frames';
import type { LanguageGenerator, LanguageGeneratorOptions } from './language';
import type { Action, Signal, FrameDescription } from './recorderActions';

export type ActionInContext = {
  frame: FrameDescription;
  action: Action;
  committed?: boolean;
};

export class CodeGenerator extends EventEmitter {
  private _currentAction: ActionInContext | null = null;
  private _lastAction: ActionInContext | null = null;
  private _actions: ActionInContext[] = [];
  private _enabled: boolean;
  private _options: LanguageGeneratorOptions;

  constructor(browserName: string, generateHeaders: boolean, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, deviceName: string | undefined, saveStorage: string | undefined) {
    super();

    // Make a copy of options to modify them later.
    launchOptions = { headless: false, ...launchOptions };
    contextOptions = { ...contextOptions };
    this._enabled = generateHeaders;
    this._options = { browserName, generateHeaders, launchOptions, contextOptions, deviceName, saveStorage };
    this.restart();
  }

  restart() {
    this._currentAction = null;
    this._lastAction = null;
    this._actions = [];
    this.emit('change');
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  addAction(action: ActionInContext) {
    if (!this._enabled)
      return;
    this.willPerformAction(action);
    this.didPerformAction(action);
  }

  willPerformAction(action: ActionInContext) {
    if (!this._enabled)
      return;
    this._currentAction = action;
  }

  performedActionFailed(action: ActionInContext) {
    if (!this._enabled)
      return;
    if (this._currentAction === action)
      this._currentAction = null;
  }

  didPerformAction(actionInContext: ActionInContext) {
    if (!this._enabled)
      return;
    const action = actionInContext.action;
    let eraseLastAction = false;
    if (this._lastAction && this._lastAction.frame.pageAlias === actionInContext.frame.pageAlias) {
      const lastAction = this._lastAction.action;
      // We augment last action based on the type.
      if (this._lastAction && action.name === 'fill' && lastAction.name === 'fill') {
        if (action.selector === lastAction.selector)
          eraseLastAction = true;
      }
      if (lastAction && action.name === 'click' && lastAction.name === 'click') {
        if (action.selector === lastAction.selector && action.clickCount > lastAction.clickCount)
          eraseLastAction = true;
      }
      if (lastAction && action.name === 'navigate' && lastAction.name === 'navigate') {
        if (action.url === lastAction.url) {
          // Already at a target URL.
          this._currentAction = null;
          return;
        }
      }
      // Check and uncheck erase click.
      if (lastAction && (action.name === 'check' || action.name === 'uncheck') && lastAction.name === 'click') {
        if (action.selector === lastAction.selector)
          eraseLastAction = true;
      }
    }

    this._lastAction = actionInContext;
    this._currentAction = null;
    if (eraseLastAction)
      this._actions.pop();
    this._actions.push(actionInContext);
    this.emit('change');
  }

  commitLastAction() {
    if (!this._enabled)
      return;
    const action = this._lastAction;
    if (action)
      action.committed = true;
  }

  signal(pageAlias: string, frame: Frame, signal: Signal) {
    if (!this._enabled)
      return;

    // Signal either arrives while action is being performed or shortly after.
    if (this._currentAction) {
      this._currentAction.action.signals.push(signal);
      return;
    }
    if (this._lastAction && !this._lastAction.committed) {
      const signals = this._lastAction.action.signals;
      if (signal.name === 'navigation' && signals.length && signals[signals.length - 1].name === 'download')
        return;
      if (signal.name === 'download' && signals.length && signals[signals.length - 1].name === 'navigation')
        signals.length = signals.length - 1;
      signal.isAsync = true;
      this._lastAction.action.signals.push(signal);
      this.emit('change');
      return;
    }

    if (signal.name === 'navigation') {
      this.addAction({
        frame: {
          pageAlias,
          isMainFrame: frame._page.mainFrame() === frame,
          url: frame.url(),
        },
        committed: true,
        action: {
          name: 'navigate',
          url: frame.url(),
          signals: [],
        },
      });
    }
  }

  generateText(languageGenerator: LanguageGenerator) {
    const text = [];
    if (this._options.generateHeaders)
      text.push(languageGenerator.generateHeader(this._options));
    for (const action of this._actions) {
      const actionText = languageGenerator.generateAction(action);
      if (actionText)
        text.push(actionText);
    }
    if (this._options.generateHeaders)
      text.push(languageGenerator.generateFooter(this._options.saveStorage));
    return text.join('\n');
  }
}
