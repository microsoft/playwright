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

import { isUnderTest } from '../utils/debug';
import { monotonicTime } from '../../utils/isomorphic/time';

import type { Signal } from '../../../../recorder/src/actions';
import type { Frame } from '../frames';
import type * as actions from '@recorder/actions';

export class RecorderSignalProcessor extends EventEmitter {
  private _lastAction: actions.ActionInContext | null = null;

  addAction(actionInContext: actions.ActionInContext, callback?: () => Promise<void>) {
    this._lastAction = actionInContext;
    this.emit('action', actionInContext);
  }

  signal(pageAlias: string, frame: Frame, signal: Signal) {
    if (signal.name === 'navigation' && frame._page.mainFrame() === frame) {
      const timestamp = monotonicTime();
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
        this.addAction({
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

    this.emit('signal', signal);
  }
}
