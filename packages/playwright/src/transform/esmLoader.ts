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
import { PortTransport } from './portTransport';
import { resolveHook, setSingleTSConfig, setTransformConfig, shouldTransform, transformHook } from './transform';
import { fileIsModule } from '../util';

// Before each import of the ESM module, a preflight request with the .esm.preflight extension is issued.
// When handled, it is resolved similarly to the reqular import, but loading it yields empty content.
const esmPreflightExtension = '.esm.preflight';

// Node < 18.6: defaultResolve takes 3 arguments.
// Node >= 18.6: nextResolve from the chain takes 2 arguments.
async function resolve(originalSpecifier: string, context: { parentURL?: string }, defaultResolve: Function) {
  let specifier = originalSpecifier.replace(esmPreflightExtension, '');
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = url.fileURLToPath(context.parentURL);
    const resolved = resolveHook(filename, specifier);
    if (resolved !== undefined)
      specifier = url.pathToFileURL(resolved).toString();
  }
  const result = await defaultResolve(specifier, context, defaultResolve);
  // Note: we collect dependencies here that will be sent to the main thread
  // (and optionally runner process) after the loading finishes.
  if (result?.url && result.url.startsWith('file://'))
    currentFileDepsCollector()?.add(url.fileURLToPath(result.url));

  if (originalSpecifier.endsWith(esmPreflightExtension))
    result.url = result.url + esmPreflightExtension;
  return result;
}

// non-js files have undefined
// some js files have null
// {module/commonjs}-typescript are changed to {module,commonjs} because we handle typescript ourselves
const kSupportedFormats = new Map([
  ['commonjs', 'commonjs'],
  ['module', 'module'],
  ['commonjs-typescript', 'commonjs'],
  ['module-typescript', 'module'],
  [null, null],
  [undefined, undefined]
]);

// Node < 18.6: defaultLoad takes 3 arguments.
// Node >= 18.6: nextLoad from the chain takes 2 arguments.
async function load(originalModuleUrl: string, context: { format?: string }, defaultLoad: Function) {
  const isPreflight = originalModuleUrl.endsWith(esmPreflightExtension);
  const moduleUrl = originalModuleUrl.replace(esmPreflightExtension, '');

  const bail =
    !kSupportedFormats.has(context.format) || // Bail out for wasm, json, etc.
    !moduleUrl.startsWith('file://');         // Bail out for built-in modules

  if (!bail) {
    const filename = url.fileURLToPath(moduleUrl);
    // Bail for node_modules.
    if (shouldTransform(filename)) {
      const code = fs.readFileSync(filename, 'utf-8');
      const transformed = transformHook(code, filename, moduleUrl);

      // Flush the source maps to the main thread, so that errors after import() are source-mapped.
      if (transformed.serializedCache)
        transport?.post('pushToCompilationCache', { cache: transformed.serializedCache });

      if (!isPreflight) {
        // Output format is required, so we determine it manually when unknown.
        // shortCircuit is required by Node >= 18.6 to designate no more loaders should be called.
        return {
          format: kSupportedFormats.get(context.format) || (fileIsModule(filename) ? 'module' : 'commonjs'),
          source: transformed.code,
          shortCircuit: true,
        };
      }
    }
  }

  if (isPreflight)
    return { format: 'module', source: 'void 0;', shortCircuit: true };
  return defaultLoad(originalModuleUrl, context, defaultLoad);
}

let transport: PortTransport | undefined;

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


module.exports = { initialize, load, resolve };
