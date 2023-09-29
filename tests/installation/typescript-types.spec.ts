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

test('typescript types should work', async ({ exec, tsc, writeFiles }) => {
  const libraryPackages = [
    'playwright',
    'playwright-core',
    'playwright-firefox',
    'playwright-webkit',
    'playwright-chromium',
  ];
  await exec('npm i @playwright/test', ...libraryPackages, { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });

  for (const libraryPackage of libraryPackages) {
    const filename = libraryPackage + '.ts';
    await writeFiles({
      [filename]: `import { Page } from '${libraryPackage}';`,
    });
    await tsc(filename);
    await tsc(`--module nodenext ${filename}`);
  }

  await tsc('playwright-test-types.ts');
  await tsc('--module nodenext playwright-test-types.ts');

  await writeFiles({
    'test.ts':
      `import { AndroidDevice, _android, AndroidWebView, Page } from 'playwright';`,
  });
  await tsc('test.ts');
});
