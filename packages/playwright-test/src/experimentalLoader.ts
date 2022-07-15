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
import { transformHook, resolveHook } from './transform';

// Node < 18.6: defaultResolve takes 3 arguments.
// Node >= 18.6: nextResolve from the chain takes 2 arguments.
async function resolve(specifier: string, context: { parentURL?: string }, defaultResolve: Function) {
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = url.fileURLToPath(context.parentURL);
    const resolved = resolveHook(filename, specifier);
    if (resolved !== undefined)
      specifier = url.pathToFileURL(resolved).toString();
  }
  return defaultResolve(specifier, context, defaultResolve);
}

// Node < 18.6: defaultLoad takes 3 arguments.
// Node >= 18.6: nextLoad from the chain takes 2 arguments.
async function load(moduleUrl: string, context: any, defaultLoad: Function) {
  if (moduleUrl.startsWith('file://') && (moduleUrl.endsWith('.ts') || moduleUrl.endsWith('.tsx'))) {
    const filename = url.fileURLToPath(moduleUrl);
    const code = fs.readFileSync(filename, 'utf-8');
    const source = transformHook(code, filename, moduleUrl);
    // shortCurcuit is required by Node >= 18.6 to designate no more loaders should be called.
    return { format: 'module', source, shortCircuit: true };
  }
  return defaultLoad(moduleUrl, context, defaultLoad);
}

module.exports = { resolve, load };
