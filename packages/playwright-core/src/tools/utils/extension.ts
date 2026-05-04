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

export const playwrightExtensionInstallUrl = `https://chromewebstore.google.com/detail/playwright-extension/${playwrightExtensionId}`;

export async function isPlaywrightExtensionInstalled(userDataDir: string): Promise<boolean> {
  // Chrome stores profiles as `Default` and `Profile <N>` subdirs of the user data dir;
  // the extension may be installed into any of them.
  let entries: string[];
  try {
    entries = await fs.promises.readdir(userDataDir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry !== 'Default' && !entry.startsWith('Profile '))
      continue;
    if (await isExtensionInstalledInProfile(path.join(userDataDir, entry)))
      return true;
  }
  return false;
}

async function isExtensionInstalledInProfile(profileDir: string): Promise<boolean> {
  // Covers two install shapes: web store drops the extension into <profile>/Extensions/<id>;
  // `--load-extension` does not, and only shows up as the id inside <profile>/Preferences.
  if (await pathExists(path.join(profileDir, 'Extensions', playwrightExtensionId)))
    return true;
  try {
    const prefs = await fs.promises.readFile(path.join(profileDir, 'Preferences'), 'utf-8');
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
