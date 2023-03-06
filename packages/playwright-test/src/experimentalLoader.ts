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
import { belongsToNodeModules, currentFileDepsCollector } from './common/compilationCache';
import { transformHook, resolveHook } from './common/transform';

// Node < 18.6: defaultResolve takes 3 arguments.
// Node >= 18.6: nextResolve from the chain takes 2 arguments.
async function resolve(specifier: string, context: { parentURL?: string }, defaultResolve: Function) {
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = url.fileURLToPath(context.parentURL);
    const resolved = resolveHook(filename, specifier);
    if (resolved !== undefined)
      specifier = url.pathToFileURL(resolved).toString();
  }
  const result = await defaultResolve(specifier, context, defaultResolve);
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
  if (belongsToNodeModules(filename))
    return defaultLoad(moduleUrl, context, defaultLoad);

  const code = fs.readFileSync(filename, 'utf-8');
  const source = transformHook(code, filename, moduleUrl);
  // Output format is always the same as input format, if it was unknown, we always report modules.
  // shortCurcuit is required by Node >= 18.6 to designate no more loaders should be called.
  return { format: context.format || 'module', source, shortCircuit: true };
}

module.exports = { resolve, load };
