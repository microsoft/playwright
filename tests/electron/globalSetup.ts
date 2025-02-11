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

import assert from 'assert';
import { spawnAsync } from '../../packages/playwright-core/lib/server/utils/spawnAsync';

export default async () => {
  const result = await spawnAsync('npx', ['electron', require.resolve('./electron-print-chromium-version.js'), '--no-sandbox'], {
    shell: true,
  });
  const chromiumVersion = result.stdout.trim();
  assert(result.code === 0);
  assert(chromiumVersion.length > 0);
  process.env.ELECTRON_CHROMIUM_VERSION = chromiumVersion;
};
