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
import { test, expect } from './npmTest';

test('codegen should print the right install command without browsers', async ({ exec }) => {
  await exec('npm i --foreground-scripts playwright', { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });

  const pwLangName2InstallCommand = {
    'java': 'mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"',
    'python': 'playwright install',
    'csharp': 'pwsh bin/Debug/netX/playwright.ps1 install',
    '': 'npx playwright install',
  };

  for (const [langName, installCommand] of Object.entries(pwLangName2InstallCommand)) {
    await test.step(`codegen should work for ${langName}`, async () => {
      const result = await exec('npx playwright codegen', {
        expectToExitWithError: true,
        env: {
          PW_LANG_NAME: langName,
        }
      });
      expect(result).toContain(installCommand);
    });
  }
});
