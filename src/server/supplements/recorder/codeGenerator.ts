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

import type { BrowserContextOptions, LaunchOptions } from '../../../..';
import { Frame } from '../../frames';
import { LanguageGenerator } from './language';
import { Action, Signal } from './recorderActions';
import { describeFrame } from './utils';

export type ActionInContext = {
  pageAlias: string;
  frameName?: string;
  frameUrl: string;
  isMainFrame: boolean;
  action: Action;
  committed?: boolean;
}

export interface CodeGeneratorOutput {
  printLn(text: string): void;
  popLn(text: string): void;
}

export class CodeGenerator {
  private _currentAction: ActionInContext | null = null;
  private _lastAction: ActionInContext | null = null;
  private _lastActionText: string | undefined;
  private _languageGenerator: LanguageGenerator;
  private _output: CodeGeneratorOutput;
  private _headerText = '';
  private _footerText = '';

  constructor(browserName: string, generateHeaders: boolean, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, output: CodeGeneratorOutput, languageGenerator: LanguageGenerator, deviceName: string | undefined, saveStorage: string | undefined) {
    this._output = output;
    this._languageGenerator = languageGenerator;

    launchOptions = { headless: false, ...launchOptions };
    if (generateHeaders) {
      this._headerText = this._languageGenerator.generateHeader(browserName, launchOptions, contextOptions, deviceName);
      this._footerText = '\n' + this._languageGenerator.generateFooter(saveStorage);
    }
    this.restart();
  }

  restart() {
    this._currentAction = null;
    this._lastAction = null;
    if (this._headerText) {
      this._output.printLn(this._headerText);
      this._output.printLn(this._footerText);
    }
  }

  addAction(action: ActionInContext) {
    this.willPerformAction(action);
    this.didPerformAction(action);
  }

  willPerformAction(action: ActionInContext) {
    this._currentAction = action;
  }

  performedActionFailed(action: ActionInContext) {
    if (this._currentAction === action)
      this._currentAction = null;
  }

  didPerformAction(actionInContext: ActionInContext) {
    const { action, pageAlias } = actionInContext;
    let eraseLastAction = false;
    if (this._lastAction && this._lastAction.pageAlias === pageAlias) {
      const { action: lastAction } = this._lastAction;
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
          this._currentAction = null;
          return;
        }
      }
      for (const name of ['check', 'uncheck']) {
        if (lastAction && action.name === name && lastAction.name === 'click') {
          if ((action as any).selector === (lastAction as any).selector)
            eraseLastAction = true;
        }
      }
    }
    this._printAction(actionInContext, eraseLastAction);
  }

  commitLastAction() {
    const action = this._lastAction;
    if (action)
      action.committed = true;
  }

  _printAction(actionInContext: ActionInContext, eraseLastAction: boolean) {
    if (this._footerText)
      this._output.popLn(this._footerText);
    if (eraseLastAction && this._lastActionText)
      this._output.popLn(this._lastActionText);
    const performingAction = !!this._currentAction;
    this._currentAction = null;
    this._lastAction = actionInContext;
    this._lastActionText = this._languageGenerator.generateAction(actionInContext, performingAction);
    this._output.printLn(this._lastActionText);
    if (this._footerText)
      this._output.printLn(this._footerText);
  }

  signal(pageAlias: string, frame: Frame, signal: Signal) {
    // Signal either arrives while action is being performed or shortly after.
    if (this._currentAction) {
      this._currentAction.action.signals.push(signal);
      return;
    }
    if (this._lastAction && !this._lastAction.committed) {
      this._lastAction.action.signals.push(signal);
      this._printAction(this._lastAction, true);
      return;
    }

    if (signal.name === 'navigation') {
      this.addAction({
        pageAlias,
        ...describeFrame(frame),
        committed: true,
        action: {
          name: 'navigate',
          url: frame.url(),
          signals: [],
        }
      });
    }
  }
}
