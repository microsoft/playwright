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
import type { Signal } from '../../../../recorder/src/actions';
import type * as actions from '@recorder/actions';
import { monotonicTime } from '../../utils/time';
import { callMetadataForAction, collapseActions } from './recorderUtils';
import { serializeError } from '../errors';
import { performAction } from './recorderRunner';
import type { CallMetadata } from '@protocol/callMetadata';
import { isUnderTest } from '../../utils/debug';

export class RecorderCollection extends EventEmitter {
  private _actions: actions.ActionInContext[] = [];
  private _enabled = false;
  private _pageAliases: Map<Page, string>;

  constructor(pageAliases: Map<Page, string>) {
    super();
    this._pageAliases = pageAliases;
  }

  restart() {
    this._actions = [];
    this._fireChange();
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  async performAction(actionInContext: actions.ActionInContext) {
    await this._addAction(actionInContext, async callMetadata => {
      await performAction(callMetadata, this._pageAliases, actionInContext);
    });
  }

  addRecordedAction(actionInContext: actions.ActionInContext) {
    if (['openPage', 'closePage'].includes(actionInContext.action.name)) {
      this._actions.push(actionInContext);
      this._fireChange();
      return;
    }
    this._addAction(actionInContext).catch(() => {});
  }

  private async _addAction(actionInContext: actions.ActionInContext, callback?: (callMetadata: CallMetadata) => Promise<void>) {
    if (!this._enabled)
      return;
    if (actionInContext.action.name === 'openPage' || actionInContext.action.name === 'closePage') {
      this._actions.push(actionInContext);
      this._fireChange();
      return;
    }

    const { callMetadata, mainFrame } = callMetadataForAction(this._pageAliases, actionInContext);
    await mainFrame.instrumentation.onBeforeCall(mainFrame, callMetadata);
    this._actions.push(actionInContext);
    this._fireChange();
    const error = await callback?.(callMetadata).catch((e: Error) => e);
    callMetadata.endTime = monotonicTime();
    actionInContext.endTime = callMetadata.endTime;
    callMetadata.error = error ? serializeError(error) : undefined;
    // Do not wait for onAfterCall so that performAction returned immediately after the action.
    mainFrame.instrumentation.onAfterCall(mainFrame, callMetadata).then(() => {
      this._fireChange();
    }).catch(() => {});
  }

  signal(pageAlias: string, frame: Frame, signal: Signal) {
    if (!this._enabled)
      return;

    if (signal.name === 'navigation' && frame._page.mainFrame() === frame) {
      const timestamp = monotonicTime();
      const lastAction = this._actions[this._actions.length - 1];
      const signalThreshold = isUnderTest() ? 500 : 5000;

      let generateGoto = false;
      if (!lastAction)
        generateGoto = true;
      else if (lastAction.action.name !== 'click' && lastAction.action.name !== 'press')
        generateGoto = true;
      else if (timestamp - lastAction.startTime > signalThreshold)
        generateGoto = true;

      if (generateGoto) {
        this.addRecordedAction({
          frame: {
            pageAlias,
            framePath: [],
          },
          action: {
            name: 'navigate',
            url: frame.url(),
            signals: [],
          },
          startTime: timestamp,
          endTime: timestamp,
        });
      }
      return;
    }

    if (this._actions.length) {
      this._actions[this._actions.length - 1].action.signals.push(signal);
      this._fireChange();
      return;
    }
  }

  private _fireChange() {
    if (!this._enabled)
      return;
    this.emit('change', collapseActions(this._actions));
  }
}
