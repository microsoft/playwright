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

import path from 'path';

// Use a dynamic path so esbuild does not statically resolve and inline
// package.json into coreBundle.js.
export const packageRoot = path.join(__dirname, '..');
export const packageJSON = require(path.join(packageRoot, 'package.json'));
export const binPath = path.join(packageRoot, 'bin');

export function libPath(...parts: string[]): string {
  return path.join(packageRoot, 'lib', ...parts);
}
