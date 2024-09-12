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
import type { Frame } from '../frames';
import type { Page } from '../page';
import type { Signal } from './recorderActions';
import type { ActionInContext } from '../codegen/types';
import type { CallMetadata } from '@protocol/callMetadata';
import { createGuid } from '../../utils/crypto';
import { monotonicTime } from '../../utils/time';
import { mainFrameForAction, traceParamsForAction } from './recorderUtils';

export class RecorderCollection extends EventEmitter {
  private _currentAction: ActionInContext | null = null;
  private _lastAction: ActionInContext | null = null;
  private _actions: ActionInContext[] = [];
  private _enabled: boolean;
  private _pageAliases: Map<Page, string>;

  constructor(pageAliases: Map<Page, string>, enabled: boolean) {
    super();
    this._enabled = enabled;
    this._pageAliases = pageAliases;
    this.restart();
  }

  restart() {
    this._currentAction = null;
    this._lastAction = null;
    this._actions = [];
    this.emit('change');
  }

  actions() {
    return this._actions;
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  async willPerformAction(actionInContext: ActionInContext): Promise<CallMetadata | null> {
    if (!this._enabled)
      return null;
    const mainFrame = mainFrameForAction(this._pageAliases, actionInContext);

    const { action } = actionInContext;
    const callMetadata: CallMetadata = {
      id: `call@${createGuid()}`,
      apiName: 'frame.' + action.name,
      objectId: mainFrame.guid,
      pageId: mainFrame._page.guid,
      frameId: mainFrame.guid,
      startTime: monotonicTime(),
      endTime: 0,
      type: 'Frame',
      method: action.name,
      params: traceParamsForAction(actionInContext),
      log: [],
    };
    await mainFrame.instrumentation.onBeforeCall(mainFrame, callMetadata);
    this._currentAction = actionInContext;
    return callMetadata;
  }

  async didPerformAction(callMetadata: CallMetadata, actionInContext: ActionInContext, error?: Error) {
    if (!this._enabled)
      return;

    if (error) {
      // Do not clear current action on delayed error.
      if (this._currentAction === actionInContext)
        this._currentAction = null;
    } else {
      this._currentAction = null;
      this._actions.push(actionInContext);
    }

    this._lastAction = actionInContext;
    const mainFrame = mainFrameForAction(this._pageAliases, actionInContext);
    callMetadata.endTime = monotonicTime();
    await mainFrame.instrumentation.onAfterCall(mainFrame, callMetadata);

    this.emit('change');
  }

  addRecordedAction(actionInContext: ActionInContext) {
    if (!this._enabled)
      return;
    this._currentAction = null;
    const action = actionInContext.action;
    let eraseLastAction = false;
    if (this._lastAction && this._lastAction.frame.pageAlias === actionInContext.frame.pageAlias) {
      const lastAction = this._lastAction.action;
      // We augment last action based on the type.
      if (this._lastAction && action.name === 'fill' && lastAction.name === 'fill') {
        if (action.selector === lastAction.selector)
          eraseLastAction = true;
      }
      if (lastAction && action.name === 'navigate' && lastAction.name === 'navigate') {
        if (action.url === lastAction.url) {
          // Already at a target URL.
          return;
        }
      }
    }

    this._lastAction = actionInContext;
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

    if (this._lastAction && (!this._lastAction.committed || signal.name !== 'navigation')) {
      const signals = this._lastAction.action.signals;
      if (signal.name === 'navigation' && signals.length && signals[signals.length - 1].name === 'download')
        return;
      if (signal.name === 'download' && signals.length && signals[signals.length - 1].name === 'navigation')
        signals.length = signals.length - 1;
      this._lastAction.action.signals.push(signal);
      this.emit('change');
      return;
    }

    if (signal.name === 'navigation' && frame._page.mainFrame() === frame) {
      this.addRecordedAction({
        frame: {
          pageAlias,
          framePath: [],
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
}
