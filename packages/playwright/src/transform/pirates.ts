/**
 *  MIT License
 *
 *  Copyright (c) 2016-2018 Ari Porad
 *  Modifications copyright (c) Microsoft Corporation.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 */

import Module from 'module';
import path from 'path';

export function addHook(transformHook: (code: string, filename: string) => string, shouldTransform: (filename: string) => boolean, extensions: string[]) {
  // This is a shortened and slightly changed version of https://github.com/danez/pirates.
  //
  // We cannot use pirates directly due to https://github.com/microsoft/playwright/issues/35812.
  // If we overwrite the '.cjs', the following code does not run because there is a custom loader defined:
  // https://github.com/nodejs/node/blob/b1973550e09d5a2a07c70be5de6e3ae4722ad230/lib/internal/modules/esm/translators.js#L397-L403
  //
  // Here we rely on the default '.js' loader to handle '.cjs' files.
  const extensionsToOverwrite = extensions.filter(e => e !== '.cjs');
  const allSupportedExtensions = new Set(extensions);
  const loaders = (Module as any)._extensions;
  const jsLoader = loaders['.js'];
  for (const extension of extensionsToOverwrite) {
    const originalLoader = loaders[extension] || jsLoader;
    function newLoader(this: any, mod: any, filename: string, ...loaderArgs: any[]) {
      if (allSupportedExtensions.has(path.extname(filename)) && shouldTransform(filename)) {
        const oldCompile = mod._compile;
        function newCompile(this: any, code: string, file: string, ...ignoredArgs: any[]) {
          // Note: we do not pass |args| downstream to make sure "esm modules" loaded through here
          // are treated as "commonjs", for example for ".mjs" files.
          // In theory, we should fix this, but it is a breaking change, even for playwright's own tests.
          mod._compile = oldCompile;
          return oldCompile.call(this, transformHook(code, filename), file);
        }
        mod._compile = newCompile;
      }
      originalLoader.call(this, mod, filename, ...loaderArgs);
    }
    loaders[extension] = newLoader;
  }
}
