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

import { removeFolders } from './fileUtils';

(async () => {
  const dirs = process.argv.slice(2);
  const errors = await removeFolders(dirs);
  for (let i = 0; i < dirs.length; ++i) {
    if (errors[i]) {
      // eslint-disable-next-line no-console
      console.error(`exception while removing ${dirs[i]}: ${errors[i]}`);
    }
  }
})();
