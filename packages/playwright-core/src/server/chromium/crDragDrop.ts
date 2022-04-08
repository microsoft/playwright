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
import type { CRPage } from './crPage';
import type * as types from '../types';
import { assert } from '../../utils';
import type { Protocol } from './protocol';
import { toModifiersMask } from './crProtocolHelper';

declare global {
  interface Window {
    __cleanupDrag?: () => Promise<boolean>;
  }
}

export class DragManager {
  private _crPage: CRPage;
  private _dragState: Protocol.Input.DragData | null = null;
  private _lastPosition = { x: 0, y: 0 };
  constructor(page: CRPage) {
    this._crPage = page;
  }

  async cancelDrag() {
    if (!this._dragState)
      return false;
    await this._crPage._mainFrameSession._client.send('Input.dispatchDragEvent', {
      type: 'dragCancel',
      x: this._lastPosition.x,
      y: this._lastPosition.y,
      data: {
        items: [],
        dragOperationsMask: 0xFFFF,
      }
    });
    this._dragState = null;
    return true;
  }

  async interceptDragCausedByMove(x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, moveCallback: () => Promise<void>): Promise<void> {
    this._lastPosition = { x, y };
    if (this._dragState) {
      await this._crPage._mainFrameSession._client.send('Input.dispatchDragEvent', {
        type: 'dragOver',
        x,
        y,
        data: this._dragState,
        modifiers: toModifiersMask(modifiers),
      });
      return;
    }
    if (button !== 'left')
      return moveCallback();

    const client = this._crPage._mainFrameSession._client;
    let onDragIntercepted: (payload: Protocol.Input.dragInterceptedPayload) => void;
    const dragInterceptedPromise = new Promise<Protocol.Input.dragInterceptedPayload>(x => onDragIntercepted = x);

    await Promise.all(this._crPage._page.frames().map(async frame => {
      await frame.nonStallingEvaluateInExistingContext((function() {
        let didStartDrag = Promise.resolve(false);
        let dragEvent: Event|null = null;
        const dragListener = (event: Event) => dragEvent = event;
        const mouseListener = () => {
          didStartDrag = new Promise<boolean>(callback => {
            window.addEventListener('dragstart', dragListener, { once: true, capture: true });
            setTimeout(() => callback(dragEvent ? !dragEvent.defaultPrevented : false), 0);
          });
        };
        window.addEventListener('mousemove', mouseListener, { once: true, capture: true });
        window.__cleanupDrag = async () => {
          const val = await didStartDrag;
          window.removeEventListener('mousemove', mouseListener, { capture: true });
          window.removeEventListener('dragstart', dragListener, { capture: true });
          delete window.__cleanupDrag;
          return val;
        };
      }).toString(), true, 'utility').catch(() => {});
    }));

    client.on('Input.dragIntercepted', onDragIntercepted!);
    try {
      await client.send('Input.setInterceptDrags', { enabled: true });
    } catch {
      // If Input.setInterceptDrags is not supported, just do a regular move.
      // This can be removed once we stop supporting old Electron.
      client.off('Input.dragIntercepted', onDragIntercepted!);
      return moveCallback();
    }
    await moveCallback();

    const expectingDrag = (await Promise.all(this._crPage._page.frames().map(async frame => {
      return frame.nonStallingEvaluateInExistingContext('window.__cleanupDrag && window.__cleanupDrag()', false, 'utility').catch(() => false);
    }))).some(x => x);
    this._dragState = expectingDrag ? (await dragInterceptedPromise).data : null;
    client.off('Input.dragIntercepted', onDragIntercepted!);
    await client.send('Input.setInterceptDrags', { enabled: false });


    if (this._dragState) {
      await this._crPage._mainFrameSession._client.send('Input.dispatchDragEvent', {
        type: 'dragEnter',
        x,
        y,
        data: this._dragState,
        modifiers: toModifiersMask(modifiers),
      });
    }
  }

  isDragging() {
    return !!this._dragState;
  }

  async drop(x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    assert(this._dragState, 'missing drag state');
    await this._crPage._mainFrameSession._client.send('Input.dispatchDragEvent', {
      type: 'drop',
      x,
      y,
      data: this._dragState,
      modifiers: toModifiersMask(modifiers),
    });
    this._dragState = null;
  }
}
