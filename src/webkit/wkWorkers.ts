/**
 * Copyright 2019 Microsoft Corporation All rights reserved.
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

import { assert, helper, RegisteredListener } from '../helper';
import { Page, Worker } from '../page';
import { Protocol } from './protocol';
import { rewriteError, WKSession, WKTargetSession } from './wkConnection';
import { WKExecutionContext } from './wkExecutionContext';

export class WKWorkers {
  private _sessionListeners: RegisteredListener[] = [];
  private _page: Page;

  constructor(page: Page) {
    this._page = page;
  }

  setSession(session: WKTargetSession) {
    helper.removeEventListeners(this._sessionListeners);
    this._sessionListeners = [
      helper.addEventListener(session, 'Worker.workerCreated', async (event: Protocol.Worker.workerCreatedPayload) => {
        const worker = new Worker(event.url);
        const workerSession = new WKWorkerSession(session, event.workerId);
        worker._createExecutionContext(new WKExecutionContext(workerSession, undefined));
        this._page._addWorker(event.workerId, worker);
        workerSession.on('Console.messageAdded', event => this._onConsoleMessage(worker, event));
        try {
          Promise.all([
            workerSession.send('Runtime.enable'),
            workerSession.send('Console.enable'),
            session.send('Worker.initialized', { workerId: event.workerId }).catch(e => {
              this._page._removeWorker(event.workerId);
            })
          ]);
        } catch (e) {
          // Worker can go as we are initializing it.
        }
      }),
      helper.addEventListener(session, 'Worker.workerTerminated', (event: Protocol.Worker.workerTerminatedPayload) => {
        this._page._removeWorker(event.workerId);
      })
    ];
  }

  async initializeSession(session: WKTargetSession) {
    await session.send('Worker.enable');
  }

  async _onConsoleMessage(worker: Worker, event: Protocol.Console.messageAddedPayload) {
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber } = event.message;
    let derivedType: string = type;
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';

    const handles = (parameters || []).map(p => {
      return worker._existingExecutionContext._createHandle(p);
    });
    this._page._addConsoleMessage(derivedType, handles, { url, lineNumber: lineNumber - 1, columnNumber: columnNumber - 1 }, handles.length ? undefined : text);
  }
}

export class WKWorkerSession extends WKSession {
  private _targetSession: WKTargetSession | null;
  private _workerId: string;
  private _lastId = 1001;

  constructor(targetSession: WKTargetSession, workerId: string) {
    super();
    this._targetSession = targetSession;
    this._workerId = workerId;
    this._targetSession.on('Worker.dispatchMessageFromWorker', event => {
      if (event.workerId === workerId)
        this._dispatchMessage(event.message);
    });
    this._targetSession.on('Worker.workerTerminated', event => {
      if (event.workerId === workerId)
        this._workerTerminated();
    });
  }

  send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]> {
    if (!this._targetSession)
      return Promise.reject(new Error(`Protocol error (${method}):  Most likely the worker has been closed.`));
    const innerId = ++this._lastId;
    const messageObj = {
      id: innerId,
      method,
      params
    };
    const message = JSON.stringify(messageObj);
    const result = new Promise<Protocol.CommandReturnValues[T]>((resolve, reject) => {
      this._callbacks.set(innerId, {resolve, reject, error: new Error(), method});
    });
    this._targetSession.send('Worker.sendMessageToWorker', {
      workerId: this._workerId,
      message: message
    }).catch(e => {
      // There is a possible race of the connection closure. We may have received
      // targetDestroyed notification before response for the command, in that
      // case it's safe to swallow the exception.
      const callback = this._callbacks.get(innerId);
      assert(!callback, 'Callback was not rejected when worker was terminated.');
    });
    return result;
  }

  _workerTerminated() {
    for (const callback of this._callbacks.values())
      callback.reject(rewriteError(callback.error, `Protocol error (${callback.method}): Worker terminated.`));
    this._callbacks.clear();
    this._targetSession = null;
  }
}
