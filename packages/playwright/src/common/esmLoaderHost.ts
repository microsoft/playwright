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
import { PortTransport } from '../transform/portTransport';
import { singleTSConfig, transformConfig } from '../transform/transform';

let loaderChannel: PortTransport | undefined;
let loaderRegisteredWithRegisterHooks = false;

type NodeModuleWithRegisterHooks = {
  register?: (specifier: any, options: any) => unknown;
  registerHooks?: (hooks: { resolve: Function, load: Function }) => unknown;
};

type ESMHooks = {
  resolve: Function;
  load: Function;
  resolveSync: Function;
  loadSync: Function;
};

export function registerESMLoaderOnModuleForTest(nodeModule: NodeModuleWithRegisterHooks, hooks: ESMHooks, registerFallback: () => void): 'registerHooks' | 'register' | undefined {
  // Node 26 prefers registerHooks for module loader hooks. Keep module.register
  // as a fallback for older supported Node versions that do not expose it.
  if (typeof nodeModule.registerHooks === 'function') {
    nodeModule.registerHooks({ resolve: hooks.resolveSync, load: hooks.loadSync });
    return 'registerHooks';
  }

  if (typeof nodeModule.register === 'function') {
    registerFallback();
    return 'register';
  }
}

export function registerESMLoader() {
  // Opt-out switch.
  if (process.env.PW_DISABLE_TS_ESM)
    return true;

  // Transpilation in `bun` is not necessary, and trying to register a hook would cause issues.
  // https://github.com/oven-sh/bun/issues/8222#issuecomment-3665364677
  if ('Bun' in globalThis)
    return true;

  if (loaderChannel || loaderRegisteredWithRegisterHooks)
    return true;

  const nodeModule = require('node:module') as NodeModuleWithRegisterHooks;
  const esmLoader = require('../transform/esmLoader.js') as ESMHooks;
  const mode = registerESMLoaderOnModuleForTest(nodeModule, esmLoader, () => {
    const { port1, port2 } = new MessageChannel();
    // register will wait until the loader is initialized.
    nodeModule.register!(url.pathToFileURL(require.resolve('../transform/esmLoader.js')), {
      data: { port: port2 },
      transferList: [port2],
    });
    loaderChannel = createPortTransport(port1);
  });
  if (!mode)
    return false;

  if (mode === 'registerHooks')
    loaderRegisteredWithRegisterHooks = true;

  return true;
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
  // This is needed to gather dependency information from the esm loader
  // that is populated from the resolve hook. We do not need to push
  // this information proactively during load, but gather it at the end.
  const result = await loaderChannel.send('getCompilationCache', {});
  addToCompilationCache(result.cache);
}

export async function configureESMLoader() {
  if (!loaderChannel)
    return;
  await loaderChannel.send('setSingleTSConfig', { tsconfig: singleTSConfig() });
  await loaderChannel.send('addToCompilationCache', { cache: serializeCompilationCache() });
}

export async function configureESMLoaderTransformConfig() {
  if (!loaderChannel)
    return;
  await loaderChannel.send('setSingleTSConfig', { tsconfig: singleTSConfig() });
  await loaderChannel.send('setTransformConfig', { config: transformConfig() });
}
