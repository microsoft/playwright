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

import { Connection } from '../../playwright-core/src/client/connection';
import { webPlatform } from './webPlatform';

import type { Browser } from '../../playwright-core/src/client/browser';

export type Options = {
  headless?: boolean;
};

export async function connect(wsEndpoint: string, browserName: string, options: Options): Promise<Browser> {
  const ws = new WebSocket(`${wsEndpoint}?browser=${browserName}&launch-options=${JSON.stringify(options)}`);
  await new Promise((f, r) => {
    ws.addEventListener('open', f);
    ws.addEventListener('error', r);
  });

  const connection = new Connection(webPlatform);
  connection.onmessage = message => ws.send(JSON.stringify(message));
  ws.addEventListener('message', message => connection.dispatch(JSON.parse(message.data)));
  ws.addEventListener('close', () => connection.close());

  const playwright = await connection.initializePlaywright();
  return playwright._preLaunchedBrowser();
}
