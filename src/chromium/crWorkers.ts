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

import { Events } from '../events';
import { debugError } from '../helper';
import { Worker } from '../page';
import { CRConnection, CRSession } from './crConnection';
import { CRExecutionContext } from './crExecutionContext';
import { ChromiumPage } from './crPage';
import { exceptionToError, toConsoleMessageLocation } from './crProtocolHelper';

export class CRWorkers {
  constructor(client: CRSession, page: ChromiumPage) {
    client.on('Target.attachedToTarget', event => {
      if (event.targetInfo.type !== 'worker')
        return;
      const url = event.targetInfo.url;
      const session = CRConnection.fromSession(client).session(event.sessionId);
      const worker = new Worker(url);
      page._addWorker(event.sessionId, worker);
      session.once('Runtime.executionContextCreated', async event => {
        worker._createExecutionContext(new CRExecutionContext(session, event.context));
      });
      // This might fail if the target is closed before we recieve all execution contexts.
      session.send('Runtime.enable', {}).catch(debugError);
      session.on('Runtime.consoleAPICalled', event => page._addConsoleMessage(event.type, event.args.map(o => worker._existingExecutionContext._createHandle(o)), toConsoleMessageLocation(event.stackTrace)));
      session.on('Runtime.exceptionThrown', exception => page.emit(Events.Page.PageError, exceptionToError(exception.exceptionDetails)));
    });
    client.on('Target.detachedFromTarget', event => page._removeWorker(event.sessionId));
  }
}
