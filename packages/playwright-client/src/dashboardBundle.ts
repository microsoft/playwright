
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

import { Connection } from '../../playwright-core/src/client/connection';
import { webPlatform } from './webPlatform';

interface Transport {
  send(message: string): void;
  onmessage?: (message: string) => void;
  onclose?: (cause?: string) => void;
}

// This entrypoint is used by Dashboard to connect to a Playwright server,
// It needs to be backwards- and forwards-compatible.
export async function connect(transport: Transport) {
  // We cannot use playwright.chromium.connect since it uses a Node.js impl of WebSocket, and we want to give the dashboard flexibility to change the transport.
  const connection = new Connection(webPlatform);
  connection.onmessage = message => transport.send(JSON.stringify(message));
  transport.onmessage = message => connection.dispatch(JSON.parse(message));
  transport.onclose = cause => connection.close(cause);

  const playwright = await connection.initializePlaywright();
  return playwright._preLaunchedBrowser();
}
