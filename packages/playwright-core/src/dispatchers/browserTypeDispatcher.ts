/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { BrowserType } from '../server/browserType';
import { BrowserDispatcher } from './browserDispatcher';
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { CallMetadata } from '../server/instrumentation';
import WebSocket from 'ws';
import { JsonPipeDispatcher } from '../dispatchers/jsonPipeDispatcher';
import { getUserAgent, makeWaitForNextTask } from '../utils/utils';
import { ManualPromise } from '../utils/async';

export class BrowserTypeDispatcher extends Dispatcher<BrowserType, channels.BrowserTypeChannel> implements channels.BrowserTypeChannel {
  _type_BrowserType = true;
  constructor(scope: DispatcherScope, browserType: BrowserType) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    }, true);
  }

  async launch(params: channels.BrowserTypeLaunchParams, metadata: CallMetadata): Promise<channels.BrowserTypeLaunchResult> {
    const browser = await this._object.launch(metadata, params);
    return { browser: new BrowserDispatcher(this._scope, browser) };
  }

  async launchPersistentContext(params: channels.BrowserTypeLaunchPersistentContextParams, metadata: CallMetadata): Promise<channels.BrowserTypeLaunchPersistentContextResult> {
    const browserContext = await this._object.launchPersistentContext(metadata, params.userDataDir, params);
    return { context: new BrowserContextDispatcher(this._scope, browserContext) };
  }

  async connectOverCDP(params: channels.BrowserTypeConnectOverCDPParams, metadata: CallMetadata): Promise<channels.BrowserTypeConnectOverCDPResult> {
    const browser = await this._object.connectOverCDP(metadata, params.endpointURL, params, params.timeout);
    const browserDispatcher = new BrowserDispatcher(this._scope, browser);
    return {
      browser: browserDispatcher,
      defaultContext: browser._defaultContext ? new BrowserContextDispatcher(browserDispatcher._scope, browser._defaultContext) : undefined,
    };
  }

  async connect(params: channels.BrowserTypeConnectParams): Promise<channels.BrowserTypeConnectResult> {
    const waitForNextTask = params.slowMo
      ? (cb: () => any) => setTimeout(cb, params.slowMo)
      : makeWaitForNextTask();
    const paramsHeaders = Object.assign({ 'User-Agent': getUserAgent() }, params.headers || {});
    const ws = new WebSocket(params.wsEndpoint, [], {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb,
      handshakeTimeout: params.timeout,
      headers: paramsHeaders,
      followRedirects: true,
    });
    const pipe = new JsonPipeDispatcher(this._scope);
    const openPromise = new ManualPromise<{ pipe: JsonPipeDispatcher }>();
    ws.on('open', () => openPromise.resolve({ pipe }));
    ws.on('close', () => pipe.wasClosed());
    ws.on('error', error => {
      if (openPromise.isDone()) {
        pipe.wasClosed(error);
      } else {
        pipe.dispose();
        openPromise.reject(error);
      }
    });
    pipe.on('close', () => ws.close());
    pipe.on('message', message => ws.send(JSON.stringify(message)));
    ws.addEventListener('message', event => {
      waitForNextTask(() => {
        try {
          pipe.dispatch(JSON.parse(event.data as string));
        } catch (e) {
          ws.close();
        }
      });
    });
    return openPromise;
  }
}
