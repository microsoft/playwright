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
import type { CallMetadata } from '@protocol/callMetadata';
import type { MockingProxy, ServerInterceptionRegistry } from '../mockingProxy';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher, existingDispatcher } from './dispatcher';
import type * as channels from '@protocol/channels';
import { SdkObject } from '../instrumentation';

export class MockingProxyDispatcher extends Dispatcher<ServerInterceptionRegistry, channels.MockingProxyChannel, RootDispatcher> implements channels.MockingProxyChannel {
  _type_MockingProxy = true;
  _type_EventTarget = true;

  static from(scope: RootDispatcher, mockingProxy: ServerInterceptionRegistry): MockingProxyDispatcher {
    return existingDispatcher<MockingProxyDispatcher>(mockingProxy) || new MockingProxyDispatcher(scope, mockingProxy);
  }

  private constructor(scope: RootDispatcher, mockingProxy: ServerInterceptionRegistry) {
    super(scope, mockingProxy, 'MockingProxy', {
      port: mockingProxy.port(),
    });
  }

  setInterceptionPatterns(params: channels.MockingProxySetInterceptionPatternsParams, metadata?: CallMetadata): Promise<channels.MockingProxySetInterceptionPatternsResult> {
    throw new Error('Method not implemented.');
  }
}
