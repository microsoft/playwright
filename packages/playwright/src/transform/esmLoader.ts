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

import fs from 'fs';
import url from 'url';
import { addToCompilationCache, currentFileDepsCollector, serializeCompilationCache, startCollectingFileDeps, stopCollectingFileDeps } from './compilationCache';
import { transformHook, resolveHook, setTransformConfig, shouldTransform, setSingleTSConfig } from './transform';
import { PortTransport } from './portTransport';
import { fileIsModule } from '../util';

// Node < 18.6: defaultResolve takes 3 arguments.
// Node >= 18.6: nextResolve from the chain takes 2 arguments.
async function resolve(specifier: string, context: { parentURL?: string }, defaultResolve: Function) {
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = url.fileURLToPath(context.parentURL);
    const resolved = resolveHook(filename, specifier, true);
    if (resolved !== undefined)
      specifier = url.pathToFileURL(resolved).toString();
  }
  const result = await defaultResolve(specifier, context, defaultResolve);
  // Note: we collect dependencies here that will be sent to the main thread
  // (and optionally runner process) after the loading finishes.
  if (result?.url && result.url.startsWith('file://'))
    currentFileDepsCollector()?.add(url.fileURLToPath(result.url));

  return result;
}

// Node < 18.6: defaultLoad takes 3 arguments.
// Node >= 18.6: nextLoad from the chain takes 2 arguments.
async function load(moduleUrl: string, context: { format?: string }, defaultLoad: Function) {
  // Bail out for wasm, json, etc.
  // non-js files have context.format === undefined
  if (context.format !== 'commonjs' && context.format !== 'module' && context.format !== undefined)
    return defaultLoad(moduleUrl, context, defaultLoad);

  // Bail for built-in modules.
  if (!moduleUrl.startsWith('file://'))
    return defaultLoad(moduleUrl, context, defaultLoad);

  const filename = url.fileURLToPath(moduleUrl);
  // Bail for node_modules.
  if (!shouldTransform(filename))
    return defaultLoad(moduleUrl, context, defaultLoad);

  const code = fs.readFileSync(filename, 'utf-8');
  const transformed = transformHook(code, filename, moduleUrl);

  // Flush the source maps to the main thread, so that errors during import() are source-mapped.
  if (transformed.serializedCache)
    await transport?.send('pushToCompilationCache', { cache: transformed.serializedCache });

  // Output format is required, so we determine it manually when unknown.
  // shortCircuit is required by Node >= 18.6 to designate no more loaders should be called.
  return {
    format: context.format || (fileIsModule(filename) ? 'module' : 'commonjs'),
    source: transformed.code,
    shortCircuit: true,
  };
}

let transport: PortTransport | undefined;

// Node.js < 20
function globalPreload(context: { port: MessagePort }) {
  transport = createTransport(context.port);
  return `
    globalThis.__esmLoaderPortPreV20 = port;
  `;
}

// Node.js >= 20
function initialize(data: { port: MessagePort }) {
  transport = createTransport(data?.port);
}

function createTransport(port: MessagePort) {
  return new PortTransport(port, async (method, params) => {
    if (method === 'setSingleTSConfig') {
      setSingleTSConfig(params.tsconfig);
      return;
    }

    if (method === 'setTransformConfig') {
      setTransformConfig(params.config);
      return;
    }

    if (method === 'addToCompilationCache') {
      addToCompilationCache(params.cache);
      return;
    }

    if (method === 'getCompilationCache')
      return { cache: serializeCompilationCache() };

    if (method === 'startCollectingFileDeps') {
      startCollectingFileDeps();
      return;
    }

    if (method === 'stopCollectingFileDeps') {
      stopCollectingFileDeps(params.file);
      return;
    }
  });
}


module.exports = { resolve, load, globalPreload, initialize };
