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

import { addToCompilationCache, serializeCompilationCache } from '../transform/compilationCache';
import { getBabelPlugins } from '../transform/transform';
import { PortTransport } from '../transform/portTransport';

const port = (globalThis as any).__esmLoaderPort;

const loaderChannel = port ? new PortTransport(port, async (method, params) => {
  if (method === 'pushToCompilationCache')
    addToCompilationCache(params.cache);
}) : undefined;

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
  await loaderChannel.send('setBabelPlugins', { plugins: getBabelPlugins() });
  await loaderChannel.send('addToCompilationCache', { cache: serializeCompilationCache() });
}
