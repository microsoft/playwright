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

import { createFilter } from '@rollup/pluginutils';

export function bundleCss(fileName) {
  const filter = createFilter(['**/*.css']);
  const files = new Map();
  let changes = 0;

  return {
    name: 'bundle-css',

    transform(code, id) {
      if (!filter(id))
        return;
      if (files.get(id) !== code) {
        files.set(id, code);
        changes++;
      }
      return '';
    },

    generateBundle(opts, bundle) {
      if (!changes)
        return;
      changes = 0;
      let source = '';
      for (const content of files.values())
        source += content;
      this.emitFile({ type: 'asset', fileName, source: source });
    }
  }
}
