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

import { monotonicTime } from '@isomorphic/time';
import { isUnderTest } from '@utils/debug';

import type { Signal } from '@isomorphic/codegen/actions';
import type { Frame } from '../frames';
import type * as actions from '@isomorphic/codegen/actions';

export interface ProcessorDelegate {
  addAction(actionInContext: actions.ActionInContext): void;
  addSignal(signalInContext: actions.SignalInContext): void;
}

// How long a single click is held back, waiting for a double click to arrive and merge with it.
const kClickBufferTimeout = 500;

type BufferedSignal = { frame: Frame, signal: Signal, timestamp: number };

export class RecorderSignalProcessor {
  private _delegate: ProcessorDelegate;
  private _lastAction: actions.ActionInContext | null = null;
  private _bufferedClick: { actionInContext: actions.ActionInContext, signals: BufferedSignal[], timeout: NodeJS.Timeout } | undefined;

  constructor(actionSink: ProcessorDelegate) {
    this._delegate = actionSink;
  }

  addAction(actionInContext: actions.ActionInContext) {
    if (this._bufferedClick) {
      if (this._isDoubleClick(actionInContext, this._bufferedClick.actionInContext)) {
        // A double click - merge it into the buffered single click and emit the result.
        actionInContext.startTime = this._bufferedClick.actionInContext.startTime;
        this._flushBufferedClick(actionInContext);
        return;
      }
      // A different action - emit the buffered click before proceeding.
      this._flushBufferedClick();
    }

    if (this._isBufferableClick(actionInContext)) {
      this._bufferedClick = {
        actionInContext,
        signals: [],
        timeout: setTimeout(() => this._flushBufferedClick(), kClickBufferTimeout),
      };
      return;
    }

    this._emitAction(actionInContext);
  }

  signal(frame: Frame, signal: Signal) {
    const timestamp = monotonicTime();
    if (this._bufferedClick) {
      this._bufferedClick.signals.push({ frame, signal, timestamp });
      return;
    }
    this._processSignal(frame, signal, timestamp);
  }

  private _isBufferableClick(actionInContext: actions.ActionInContext): boolean {
    const action = actionInContext.action;
    return action.name === 'click' && action.button === 'left' && action.clickCount === 1;
  }

  private _isDoubleClick(actionInContext: actions.ActionInContext, bufferedClick: actions.ActionInContext): boolean {
    const action = actionInContext.action;
    const buffered = bufferedClick.action;
    return action.name === 'click' && buffered.name === 'click'
      && actionInContext.pageGuid === bufferedClick.pageGuid
      && action.selector === buffered.selector
      && action.clickCount > buffered.clickCount;
  }

  private _emitAction(actionInContext: actions.ActionInContext) {
    this._lastAction = actionInContext;
    this._delegate.addAction(actionInContext);
  }

  private _flushBufferedClick(replacement?: actions.ActionInContext) {
    const buffered = this._bufferedClick;
    if (!buffered)
      return;
    clearTimeout(buffered.timeout);
    this._bufferedClick = undefined;
    this._emitAction(replacement ?? buffered.actionInContext);
    // Replay the signals with their original timestamps, so that they attach to the emitted action.
    for (const { frame, signal, timestamp } of buffered.signals)
      this._processSignal(frame, signal, timestamp);
  }

  private _processSignal(frame: Frame, signal: Signal, timestamp: number) {
    if (signal.name === 'navigation' && frame._page.mainFrame() === frame) {
      const lastAction = this._lastAction;
      const signalThreshold = isUnderTest() ? 500 : 5000;

      let generateGoto = false;
      if (!lastAction)
        generateGoto = true;
      else if (lastAction.action.name !== 'click' && lastAction.action.name !== 'press' && lastAction.action.name !== 'fill')
        generateGoto = true;
      else if (timestamp - lastAction.startTime > signalThreshold)
        generateGoto = true;

      if (generateGoto) {
        this._emitAction({
          pageGuid: frame._page.guid,
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

    this._delegate.addSignal({
      pageGuid: frame._page.guid,
      signal,
      timestamp,
    });
  }
}
