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
import { transformHook } from './transform';

async function resolve(specifier: string, context: { parentURL: string }, defaultResolve: any) {
  if (specifier.endsWith('.js') || specifier.endsWith('.ts') || specifier.endsWith('.mjs'))
    return defaultResolve(specifier, context, defaultResolve);
  let url = new URL(specifier, context.parentURL).toString();
  url = url.substring('file://'.length);
  for (const extension of ['.ts', '.js', '.tsx', '.jsx']) {
    if (fs.existsSync(url + extension))
      return defaultResolve(specifier + extension, context, defaultResolve);
  }
  return defaultResolve(specifier, context, defaultResolve);
}

async function load(url: string, context: any, defaultLoad: any) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const filename = url.substring('file://'.length);
    const code = fs.readFileSync(filename, 'utf-8');
    const source = transformHook(code, filename, true);
    return { format: 'module', source };
  }
  return defaultLoad(url, context, defaultLoad);
}

module.exports = { resolve, load };
