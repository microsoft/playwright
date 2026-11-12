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

type Listener = (...args: any[]) => void;

// Chrome starts a stopped service worker for each event that has a listener, so the listeners are on only while a client needs them.
export class ChromeListeners {
  private _listeners: { event: chrome.events.Event<any>, listener: Listener }[] = [];
  private _enabled = false;

  add<T extends Listener>(event: chrome.events.Event<T>, listener: T): void {
    this._listeners.push({ event, listener });
    if (this._enabled)
      event.addListener(listener);
  }

  setEnabled(enabled: boolean): void {
    if (this._enabled === enabled)
      return;
    this._enabled = enabled;
    for (const { event, listener } of this._listeners) {
      if (enabled)
        event.addListener(listener);
      else
        event.removeListener(listener);
    }
  }
}
