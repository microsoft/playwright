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
import { monotonicTime } from '../../utils/time';
import { callMetadataForAction, collapseActions, traceEventsToAction } from './recorderUtils';
import { serializeError } from '../errors';
import { performAction } from './recorderRunner';
import type { CallMetadata } from '@protocol/callMetadata';
import { isUnderTest } from '../../utils/debug';
import type { BrowserContext } from '../browserContext';

export class RecorderCollection extends EventEmitter {
  private _actions: ActionInContext[] = [];
  private _enabled = false;
  private _pageAliases: Map<Page, string>;
  private _context: BrowserContext;

  constructor(codegenMode: 'actions' | 'trace-events', context: BrowserContext, pageAliases: Map<Page, string>) {
    super();
    this._context = context;
    this._pageAliases = pageAliases;

    if (codegenMode === 'trace-events') {
      this._context.tracing.onMemoryEvents(events => {
        this._actions = traceEventsToAction(events);
        this._fireChange();
      });
    }
  }

  restart() {
    this._actions = [];
    this._fireChange();
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  async performAction(actionInContext: ActionInContext) {
    await this._addAction(actionInContext, async callMetadata => {
      await performAction(callMetadata, this._pageAliases, actionInContext);
    });
  }

  addRecordedAction(actionInContext: ActionInContext) {
    if (['openPage', 'closePage'].includes(actionInContext.action.name)) {
      this._actions.push(actionInContext);
      this._fireChange();
      return;
    }
    this._addAction(actionInContext).catch(() => {});
  }

  private async _addAction(actionInContext: ActionInContext, callback?: (callMetadata: CallMetadata) => Promise<void>) {
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
    callMetadata.error = error ? serializeError(error) : undefined;
    await mainFrame.instrumentation.onAfterCall(mainFrame, callMetadata);
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
      else if (timestamp - lastAction.timestamp > signalThreshold)
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
          timestamp
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
    this.emit('change', collapseActions(this._actions));
  }
}
