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

import { currentFileDepsCollector } from './compilationCache';
import { resolveHook, shouldTransform, transformHook } from './transform';
import { fileIsModule } from '../util';

export function resolve(specifier: string, context: { parentURL?: string, conditions?: string[] | Set<string> }, nextResolve: Function) {
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = url.fileURLToPath(context.parentURL);
    const resolved = resolveHook(filename, specifier);
    if (resolved !== undefined) {
      // These hooks serve both require() and import. The two default resolvers disagree on
      // what an already-resolved specifier should look like:
      // - require()'s resolver wants an absolute path and rejects file:// specifiers;
      // - the ESM resolver wants a file:// URL and, on Windows, mistakes an absolute path's
      //   drive letter for a URL scheme ("Received protocol 'c:'").
      // The `import` condition is present only for ESM resolution, so use it to pick the form.
      specifier = new Set(context.conditions).has('import') ? url.pathToFileURL(resolved).toString() : resolved;
    }
  }
  const result = nextResolve(specifier, context);
  if (result?.url && result.url.startsWith('file://'))
    currentFileDepsCollector()?.add(url.fileURLToPath(result.url));
  return result;
}

// non-js files have undefined
// some js files have null
// {module/commonjs}-typescript are changed to {module,commonjs} because we handle typescript ourselves
// plain 'typescript' (a require()-d .ts with module kind not yet determined) maps to null,
// so the module kind is computed below via fileIsModule().
const kSupportedFormats = new Map([
  ['commonjs', 'commonjs'],
  ['module', 'module'],
  ['commonjs-typescript', 'commonjs'],
  ['module-typescript', 'module'],
  ['typescript', null],
  [null, null],
  [undefined, undefined]
]);

export function load(moduleUrl: string, context: { format?: string }, nextLoad: Function) {
  // Bail out for wasm, json, etc.
  if (!kSupportedFormats.has(context.format))
    return nextLoad(moduleUrl, context);

  // Bail for built-in modules.
  if (!moduleUrl.startsWith('file://'))
    return nextLoad(moduleUrl, context);

  const filename = url.fileURLToPath(moduleUrl);

  // Bail for node_modules.
  if (!shouldTransform(filename))
    return nextLoad(moduleUrl, context);

  // Output format is required, so we determine it manually when unknown.
  const format = kSupportedFormats.get(context.format) || (fileIsModule(filename) ? 'module' : 'commonjs');

  const code = fs.readFileSync(filename, 'utf-8');
  // Pass `moduleUrl` only for ESM. For CommonJS we omit it so that babel
  // down-transpiles `import`/`export` to `require`/`exports`.
  const transformed = transformHook(code, filename, format === 'module' ? moduleUrl : undefined);

  // shortCircuit is required to designate no more loaders should be called.
  return {
    format,
    source: transformed.code,
    shortCircuit: true,
  };
}
