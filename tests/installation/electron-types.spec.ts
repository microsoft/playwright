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
import { test } from './npmTest';

test('electron types', async ({ exec, tsc, writeFiles }) => {
  await exec('npm i --foreground-scripts playwright electron@12', { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
  await writeFiles({
    'test.ts':
      `import { Page, _electron, ElectronApplication, Electron } from 'playwright';`
  });
  await tsc('test.ts');
});
