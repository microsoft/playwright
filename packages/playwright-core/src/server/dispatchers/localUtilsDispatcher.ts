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

import { Dispatcher } from './dispatcher';
import { SdkObject } from '../../server/instrumentation';
import * as localUtils from '../localUtils';
import { getUserAgent } from '../utils/userAgent';
import { deviceDescriptors as descriptors }  from '../deviceDescriptors';
import { JsonPipeDispatcher } from '../dispatchers/jsonPipeDispatcher';
import { Progress, ProgressController } from '../progress';
import { SocksInterceptor } from '../socksInterceptor';
import { WebSocketTransport } from '../transport';
import { fetchData } from '../utils/network';
import { resolveGlobToRegexPattern } from '../../utils/isomorphic/urlMatch';

import type { HarBackend } from '../harBackend';
import type { CallMetadata } from '../instrumentation';
import type { Playwright } from '../playwright';
import type { RootDispatcher } from './dispatcher';
import type * as channels from '@protocol/channels';
import type * as http from 'http';
import type { HTTPRequestParams } from '../utils/network';

export class LocalUtilsDispatcher extends Dispatcher<{ guid: string }, channels.LocalUtilsChannel, RootDispatcher> implements channels.LocalUtilsChannel {
  _type_LocalUtils: boolean;
  private _harBackends = new Map<string, HarBackend>();
  private _stackSessions = new Map<string, localUtils.StackSession>();

  constructor(scope: RootDispatcher, playwright: Playwright) {
    const localUtils = new SdkObject(playwright, 'localUtils', 'localUtils');
    const deviceDescriptors = Object.entries(descriptors)
        .map(([name, descriptor]) => ({ name, descriptor }));
    super(scope, localUtils, 'LocalUtils', {
      deviceDescriptors,
    });
    this._type_LocalUtils = true;
  }

  async zip(params: channels.LocalUtilsZipParams): Promise<void> {
    return await localUtils.zip(this._stackSessions, params);
  }

  async harOpen(params: channels.LocalUtilsHarOpenParams, metadata: CallMetadata): Promise<channels.LocalUtilsHarOpenResult> {
    return await localUtils.harOpen(this._harBackends, params);
  }

  async harLookup(params: channels.LocalUtilsHarLookupParams, metadata: CallMetadata): Promise<channels.LocalUtilsHarLookupResult> {
    return await localUtils.harLookup(this._harBackends, params);
  }

  async harClose(params: channels.LocalUtilsHarCloseParams, metadata: CallMetadata): Promise<void> {
    return await localUtils.harClose(this._harBackends, params);
  }

  async harUnzip(params: channels.LocalUtilsHarUnzipParams, metadata: CallMetadata): Promise<void> {
    return await localUtils.harUnzip(params);
  }

  async tracingStarted(params: channels.LocalUtilsTracingStartedParams, metadata?: CallMetadata | undefined): Promise<channels.LocalUtilsTracingStartedResult> {
    return await localUtils.tracingStarted(this._stackSessions, params);
  }

  async traceDiscarded(params: channels.LocalUtilsTraceDiscardedParams, metadata?: CallMetadata | undefined): Promise<void> {
    return await localUtils.traceDiscarded(this._stackSessions, params);
  }

  async addStackToTracingNoReply(params: channels.LocalUtilsAddStackToTracingNoReplyParams, metadata?: CallMetadata | undefined): Promise<void> {
    return await localUtils.addStackToTracingNoReply(this._stackSessions, params);
  }

  async connect(params: channels.LocalUtilsConnectParams, metadata: CallMetadata): Promise<channels.LocalUtilsConnectResult> {
    const controller = new ProgressController(metadata, this._object as SdkObject);
    controller.setLogName('browser');
    return await controller.run(async progress => {
      const wsHeaders = {
        'User-Agent': getUserAgent(),
        'x-playwright-proxy': params.exposeNetwork ?? '',
        ...params.headers,
      };
      const wsEndpoint = await urlToWSEndpoint(progress, params.wsEndpoint);

      const transport = await WebSocketTransport.connect(progress, wsEndpoint, { headers: wsHeaders, followRedirects: true, debugLogHeader: 'x-playwright-debug-log' });
      const socksInterceptor = new SocksInterceptor(transport, params.exposeNetwork, params.socksProxyRedirectPortForTest);
      const pipe = new JsonPipeDispatcher(this);
      transport.onmessage = json => {
        if (socksInterceptor.interceptMessage(json))
          return;
        const cb = () => {
          try {
            pipe.dispatch(json);
          } catch (e) {
            transport.close();
          }
        };
        if (params.slowMo)
          setTimeout(cb, params.slowMo);
        else
          cb();
      };
      pipe.on('message', message => {
        transport.send(message);
      });
      transport.onclose = (reason?: string) => {
        socksInterceptor?.cleanup();
        pipe.wasClosed(reason);
      };
      pipe.on('close', () => transport.close());
      return { pipe, headers: transport.headers };
    }, params.timeout);
  }

  async globToRegex(params: channels.LocalUtilsGlobToRegexParams, metadata?: CallMetadata): Promise<channels.LocalUtilsGlobToRegexResult> {
    const regex = resolveGlobToRegexPattern(params.baseURL, params.glob, params.webSocketUrl);
    return { regex };
  }
}

async function urlToWSEndpoint(progress: Progress, endpointURL: string): Promise<string> {
  if (endpointURL.startsWith('ws'))
    return endpointURL;

  progress.log(`<ws preparing> retrieving websocket url from ${endpointURL}`);
  const fetchUrl = new URL(endpointURL);
  if (!fetchUrl.pathname.endsWith('/'))
    fetchUrl.pathname += '/';
  fetchUrl.pathname += 'json';
  const json = await fetchData({
    url: fetchUrl.toString(),
    method: 'GET',
    timeout: progress.timeUntilDeadline(),
    headers: { 'User-Agent': getUserAgent() },
  }, async (params: HTTPRequestParams, response: http.IncomingMessage) => {
    return new Error(`Unexpected status ${response.statusCode} when connecting to ${fetchUrl.toString()}.\n` +
        `This does not look like a Playwright server, try connecting via ws://.`);
  });
  progress.throwIfAborted();

  const wsUrl = new URL(endpointURL);
  let wsEndpointPath = JSON.parse(json).wsEndpointPath;
  if (wsEndpointPath.startsWith('/'))
    wsEndpointPath = wsEndpointPath.substring(1);
  if (!wsUrl.pathname.endsWith('/'))
    wsUrl.pathname += '/';
  wsUrl.pathname += wsEndpointPath;
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return wsUrl.toString();
}
