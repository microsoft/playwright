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

import { nodePlatform } from './server/utils/nodePlatform';
import { Connection } from './client/connection';

import type { Browser } from '../types/types';

export interface ServerTransport {
  send(message: string): void;
  close(): void;
  on(event: 'message', handler: (message: string) => void): void;
  on(event: 'close', handler: () => void): void;
}

export async function connectToBrowser(transport: ServerTransport): Promise<Browser> {
  const connection = new Connection(nodePlatform);
  connection.onmessage = message => transport.send(JSON.stringify(message));
  connection.on('close', () => transport.close());
  transport.on('close', () => connection.close());
  transport.on('message', message => {
    try {
      connection.dispatch(JSON.parse(message));
    } catch (e) {
      console.error('transport.onmessage error', e);
    }
  });
  const playwright = await connection.initializePlaywright();
  return playwright._preLaunchedBrowser();
}
