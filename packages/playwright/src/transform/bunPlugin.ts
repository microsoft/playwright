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

import { fileIsModule } from '../util';
import { resolveHook, shouldTransform, transformHook } from './transform';

let registered = false;

export function registerBunPlugin() {
  if (registered)
    return;
  registered = true;
  Bun.plugin({
    name: 'playwright-transform',
    setup(build: Bun.PluginBuilder) {
      build.onLoad({ filter: /\.(ts|tsx|cts|mts|jsx|cjs|mjs|js)$/ }, async (args: Bun.OnLoadArgs) => {
        if (!shouldTransform(args.path))
          return undefined;
        const source = await Bun.file(args.path).text();
        const moduleUrl = fileIsModule(args.path) ? url.pathToFileURL(args.path).toString() : undefined;
        const { code } = transformHook(source, args.path, moduleUrl);
        return { contents: code, loader: 'js' };
      });
      build.onResolve({ filter: /.*/ }, (args: Bun.OnResolveArgs) => {
        if (!args.importer)
          return undefined;
        const resolved = resolveHook(args.importer, args.path);
        return resolved ? { path: resolved } : undefined;
      });
    },
  });
}
