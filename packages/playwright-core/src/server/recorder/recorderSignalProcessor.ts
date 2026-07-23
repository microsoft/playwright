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

// How long an action is held back, waiting for a superseding action to merge with it:
// a double click after a click, another keystroke after a fill, another navigation.
const kActionBufferTimeout = 500;

type BufferedSignal = { frame: Frame, signal: Signal, timestamp: number };

export class RecorderSignalProcessor {
  private _delegate: ProcessorDelegate;
  private _lastAction: actions.ActionInContext | null = null;
  private _lastActionTimestamp = 0;
  private _pendingAction: { actionInContext: actions.ActionInContext, receivedAt: number, signals: BufferedSignal[], timeout: NodeJS.Timeout } | undefined;

  constructor(actionSink: ProcessorDelegate) {
    this._delegate = actionSink;
  }

  addAction(actionInContext: actions.ActionInContext) {
    const timestamp = monotonicTime();
    if (this._pendingAction) {
      if (this._supersedes(actionInContext, this._pendingAction.actionInContext)) {
        this._pendingAction.actionInContext = actionInContext;
        this._pendingAction.receivedAt = timestamp;
        this._resetPendingTimeout();
        return;
      }
      this._flushPendingAction();
    }

    if (this._shouldBuffer(actionInContext)) {
      this._pendingAction = {
        actionInContext,
        receivedAt: timestamp,
        signals: [],
        timeout: setTimeout(() => this._flushPendingAction(), kActionBufferTimeout),
      };
      return;
    }

    this._emitAction(actionInContext, timestamp);
  }

  signal(frame: Frame, signal: Signal) {
    const timestamp = monotonicTime();
    const isMainFrameNavigation = signal.name === 'navigation' && frame._page.mainFrame() === frame;
    if (this._pendingAction?.actionInContext.action.name === 'navigate' && isMainFrameNavigation && this._pendingAction.actionInContext.pageGuid === frame._page.guid) {
      this._pendingAction.actionInContext.action.url = frame.url();
      this._resetPendingTimeout();
      return;
    }
    if (this._pendingAction)
      this._pendingAction.signals.push({ frame, signal, timestamp });
    else
      this._processSignal(frame, signal, timestamp);
  }

  private _shouldBuffer(actionInContext: actions.ActionInContext): boolean {
    const action = actionInContext.action;
    return (action.name === 'click' && action.button === 'left') || action.name === 'fill' || action.name === 'navigate';
  }

  private _supersedes(actionInContext: actions.ActionInContext, pending: actions.ActionInContext): boolean {
    const action = actionInContext.action;
    const pendingAction = pending.action;
    if (actionInContext.pageGuid !== pending.pageGuid)
      return false;
    // A higher click count on the same target is a double (or triple) click.
    if (action.name === 'click' && pendingAction.name === 'click')
      return action.selector === pendingAction.selector && action.clickCount > pendingAction.clickCount;
    // Another keystroke into the same field supersedes the previous value.
    if (action.name === 'fill' && pendingAction.name === 'fill')
      return action.selector === pendingAction.selector;
    // Another navigation on the same page supersedes the previous url.
    if (action.name === 'navigate' && pendingAction.name === 'navigate')
      return true;
    return false;
  }

  private _resetPendingTimeout() {
    if (!this._pendingAction)
      return;
    clearTimeout(this._pendingAction.timeout);
    this._pendingAction.timeout = setTimeout(() => this._flushPendingAction(), kActionBufferTimeout);
  }

  private _emitAction(actionInContext: actions.ActionInContext, timestamp: number) {
    this._lastAction = actionInContext;
    this._lastActionTimestamp = timestamp;
    this._delegate.addAction(actionInContext);
  }

  private _flushPendingAction() {
    const pending = this._pendingAction;
    if (!pending)
      return;
    clearTimeout(pending.timeout);
    this._pendingAction = undefined;
    this._emitAction(pending.actionInContext, pending.receivedAt);
    // Replay the signals with their original timestamps, so that they attach to the emitted action.
    for (const { frame, signal, timestamp } of pending.signals)
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
      else if (timestamp - this._lastActionTimestamp > signalThreshold)
        generateGoto = true;

      if (generateGoto) {
        this.addAction({
          pageGuid: frame._page.guid,
          action: {
            name: 'navigate',
            url: frame.url(),
          },
          signals: [],
        });
      }
      return;
    }

    this._delegate.addSignal({
      pageGuid: frame._page.guid,
      signal,
    });
  }
}
