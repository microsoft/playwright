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

// Bundles inline this, so the version must be final before the build: see utils/publish_all_packages.sh.
import packageJSON from '../package.json';

export { packageJSON };
export const packageRoot = path.join(__dirname, '..');
export const binPath = path.join(packageRoot, 'bin');

export function libPath(...parts: string[]): string {
  return path.join(packageRoot, 'lib', ...parts);
}
