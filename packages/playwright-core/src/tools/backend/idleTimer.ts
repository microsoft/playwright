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

// Only headless browsers we launched get this by default, headed and attached ones may be in use by a person.
export const defaultIdleTimeout = 60 * 60 * 1000;

export class IdleTimer {
  private _timeout: number;
  private _onIdle: () => void;
  private _running = 0;
  private _timer: NodeJS.Timeout | undefined;

  constructor(timeout: number, onIdle: () => void) {
    this._timeout = timeout;
    this._onIdle = onIdle;
  }

  // For a session that is ready before its first call and may never receive one.
  arm() {
    this._timer = setTimeout(this._onIdle, this._timeout).unref();
  }

  callStarted() {
    ++this._running;
    this.dispose();
  }

  callFinished() {
    if (!--this._running)
      this.arm();
  }

  dispose() {
    clearTimeout(this._timer);
    this._timer = undefined;
  }
}
