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

async function resolve(specifier: string, context: { parentURL: string }, defaultResolve: any) {
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = url.fileURLToPath(context.parentURL);
    const resolved = resolveHook(filename, specifier);
    if (resolved !== undefined)
      specifier = url.pathToFileURL(resolved).toString();
  }
  return defaultResolve(specifier, context, defaultResolve);
}

async function load(moduleUrl: string, context: any, defaultLoad: any) {
  if (moduleUrl.startsWith('file://') && (moduleUrl.endsWith('.ts') || moduleUrl.endsWith('.tsx'))) {
    const filename = url.fileURLToPath(moduleUrl);
    const code = fs.readFileSync(filename, 'utf-8');
    const source = transformHook(code, filename, true);
    return { format: 'module', source };
  }
  return defaultLoad(moduleUrl, context, defaultLoad);
}

module.exports = { resolve, load };
