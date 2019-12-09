/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'events';
import { CDPSession, Connection } from '../Connection';
import { debugError } from '../../helper';
import { Protocol } from '../protocol';
import { Events } from '../events';
import * as types from '../../types';
import * as js from '../../javascript';
import * as console from '../../console';
import { ExecutionContextDelegate } from '../ExecutionContext';
import { toConsoleMessageLocation, exceptionToError } from '../protocolHelper';

type AddToConsoleCallback = (type: string, args: js.JSHandle[], location: console.ConsoleMessageLocation) => void;
type HandleExceptionCallback = (error: Error) => void;

export class Workers extends EventEmitter {
  private _workers = new Map<string, Worker>();

  constructor(client: CDPSession, addToConsole: AddToConsoleCallback, handleException: HandleExceptionCallback) {
    super();

    client.on('Target.attachedToTarget', event => {
      if (event.targetInfo.type !== 'worker')
        return;
      const session = Connection.fromSession(client).session(event.sessionId);
      const worker = new Worker(session, event.targetInfo.url, addToConsole, handleException);
      this._workers.set(event.sessionId, worker);
      this.emit(Events.Workers.WorkerCreated, worker);
    });
    client.on('Target.detachedFromTarget', event => {
      const worker = this._workers.get(event.sessionId);
      if (!worker)
        return;
      this.emit(Events.Workers.WorkerDestroyed, worker);
      this._workers.delete(event.sessionId);
    });
  }

  list(): Worker[] {
    return Array.from(this._workers.values());
  }
}

export class Worker extends EventEmitter {
  private _client: CDPSession;
  private _url: string;
  private _executionContextPromise: Promise<js.ExecutionContext>;
  private _executionContextCallback: (value?: js.ExecutionContext) => void;

  constructor(client: CDPSession, url: string, addToConsole: AddToConsoleCallback, handleException: HandleExceptionCallback) {
    super();
    this._client = client;
    this._url = url;
    this._executionContextPromise = new Promise(x => this._executionContextCallback = x);
    let jsHandleFactory: (o: Protocol.Runtime.RemoteObject) => js.JSHandle;
    this._client.once('Runtime.executionContextCreated', async event => {
      jsHandleFactory = remoteObject => executionContext._createHandle(remoteObject);
      const executionContext = new js.ExecutionContext(new ExecutionContextDelegate(client, event.context));
      this._executionContextCallback(executionContext);
    });
    // This might fail if the target is closed before we recieve all execution contexts.
    this._client.send('Runtime.enable', {}).catch(debugError);

    this._client.on('Runtime.consoleAPICalled', event => addToConsole(event.type, event.args.map(jsHandleFactory), toConsoleMessageLocation(event.stackTrace)));
    this._client.on('Runtime.exceptionThrown', exception => handleException(exceptionToError(exception.exceptionDetails)));
  }

  url(): string {
    return this._url;
  }

  async executionContext(): Promise<js.ExecutionContext> {
    return this._executionContextPromise;
  }

  evaluate: types.Evaluate = async (pageFunction, ...args) => {
    return (await this._executionContextPromise).evaluate(pageFunction, ...args as any);
  }

  evaluateHandle: types.EvaluateHandle = async (pageFunction, ...args) => {
    return (await this._executionContextPromise).evaluateHandle(pageFunction, ...args as any);
  }
}
