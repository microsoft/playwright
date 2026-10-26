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

const scopes = new WeakMap<object, ListenerErrorScope>();

export class ListenerErrorScope {
  private _handler: ((error: unknown) => void) | undefined;

  constructor(handler: (error: unknown) => void) {
    this._handler = handler;
  }

  register(functionPrototype: object) {
    scopes.set(functionPrototype, this);
  }

  dispose() {
    this._handler = undefined;
  }

  static tryHandle(listener: object, error: unknown): boolean {
    const scope = scopes.get(Object.getPrototypeOf(listener));
    if (!scope?._handler)
      return false;
    scope._handler(error);
    return true;
  }
}
