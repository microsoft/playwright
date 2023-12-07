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

import url from 'url';
import { addToCompilationCache, serializeCompilationCache } from '../transform/compilationCache';
import { transformConfig } from '../transform/transform';
import { PortTransport } from '../transform/portTransport';
import { kSupportsModuleRegister } from '../transform/esmUtils';

let loaderChannel: PortTransport | undefined;
// Node.js < 21
if ((globalThis as any).__legacyEsmLoaderPort)
  loaderChannel = createPortTransport((globalThis as any).__legacyEsmLoaderPort);

export function registerESMLoader() {
  if (!kSupportsModuleRegister)
    return;
  // Node.js >= 21
  const { port1, port2 } = new MessageChannel();
  // register will wait until the loader is initialized.
  require('node:module').register(require.resolve('../transform/esmLoader'), {
    parentURL: url.pathToFileURL(__filename),
    data: { port: port2 },
    transferList: [port2],
  });
  loaderChannel = createPortTransport(port1);
}

function createPortTransport(port: MessagePort) {
  return new PortTransport(port, async (method, params) => {
    if (method === 'pushToCompilationCache')
      addToCompilationCache(params.cache);
  });
}

export async function startCollectingFileDeps() {
  if (!loaderChannel)
    return;
  await loaderChannel.send('startCollectingFileDeps', {});
}

export async function stopCollectingFileDeps(file: string) {
  if (!loaderChannel)
    return;
  await loaderChannel.send('stopCollectingFileDeps', { file });
}

export async function incorporateCompilationCache() {
  if (!loaderChannel)
    return;
  const result = await loaderChannel.send('getCompilationCache', {});
  addToCompilationCache(result.cache);
}

export async function initializeEsmLoader() {
  if (!loaderChannel)
    return;
  await loaderChannel.send('setTransformConfig', { config: transformConfig() });
  await loaderChannel.send('addToCompilationCache', { cache: serializeCompilationCache() });
}
