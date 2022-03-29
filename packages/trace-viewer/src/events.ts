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

export namespace Disposable {
  export function disposeAll(disposables: Disposable[]): void {
    for (const disposable of disposables.splice(0))
      disposable.dispose();
  }
}

export type Disposable = {
  dispose(): void;
};

export interface Event<T> {
  (listener: (e: T) => any, disposables?: Disposable[]): Disposable;
}

export class EventEmitter<T> {
  public event: Event<T>;

  private _deliveryQueue?: {listener: (e: T) => void, event: T}[];
  private _listeners = new Set<(e: T) => void>();

  constructor() {
    this.event = (listener: (e: T) => any, disposables?: Disposable[]) => {
      this._listeners.add(listener);
      let disposed = false;
      const self = this;
      const result: Disposable = {
        dispose() {
          if (!disposed) {
            disposed = true;
            self._listeners.delete(listener);
          }
        }
      };
      if (disposables)
        disposables.push(result);
      return result;
    };
  }

  fire(event: T): void {
    const dispatch = !this._deliveryQueue;
    if (!this._deliveryQueue)
      this._deliveryQueue = [];
    for (const listener of this._listeners)
      this._deliveryQueue.push({ listener, event });
    if (!dispatch)
      return;
    for (let index = 0; index < this._deliveryQueue.length; index++) {
      const { listener, event } = this._deliveryQueue[index];
      listener.call(null, event);
    }
    this._deliveryQueue = undefined;
  }

  dispose() {
    this._listeners.clear();
    if (this._deliveryQueue)
      this._deliveryQueue = [];
  }
}
