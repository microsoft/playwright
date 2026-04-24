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

import fs from 'fs';
import path from 'path';

// Also pinned via the "key" field in packages/extension/manifest.json.
export const playwrightExtensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';

export const playwrightExtensionInstallUrl = `https://chromewebstore.google.com/detail/playwright-mcp-bridge/${playwrightExtensionId}`;

export async function isPlaywrightExtensionInstalled(userDataDir: string): Promise<boolean> {
  // Covers two install shapes: web store drops the extension into Default/Extensions/<id>;
  // `--load-extension` does not, and only shows up as the id inside Default/Preferences.
  if (await pathExists(path.join(userDataDir, 'Default', 'Extensions', playwrightExtensionId)))
    return true;
  try {
    const prefs = await fs.promises.readFile(path.join(userDataDir, 'Default', 'Preferences'), 'utf-8');
    return prefs.includes(`"${playwrightExtensionId}"`);
  } catch {
    return false;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
