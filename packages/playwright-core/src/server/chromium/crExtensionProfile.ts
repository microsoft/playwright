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

import { existsAsync } from '@utils/fileUtils';

// The CLI client has the same check in tools/utils/extension.ts, because tools and the server
// cannot import each other. Keep the two checks the same.

// Also pinned via the "key" field in packages/extension/manifest.json.
export const playwrightExtensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';

export const playwrightExtensionInstallUrl = `https://chromewebstore.google.com/detail/playwright-extension/${playwrightExtensionId}`;

export async function isExtensionInstalledInProfile(profileDir: string): Promise<boolean> {
  // Web store installs unpack into <profile>/Extensions/<id>; `--load-extension` only
  // leaves a settings record in the preferences.
  if (await existsAsync(path.join(profileDir, 'Extensions', playwrightExtensionId)))
    return true;
  // `extensions.settings` lives in Preferences or Secure Preferences depending on the platform.
  for (const fileName of ['Preferences', 'Secure Preferences']) {
    if (await hasExtensionSettingsRecord(path.join(profileDir, fileName)))
      return true;
  }
  return false;
}

async function hasExtensionSettingsRecord(prefsPath: string): Promise<boolean> {
  let prefs: any;
  try {
    prefs = JSON.parse(await fs.promises.readFile(prefsPath, 'utf-8'));
  } catch {
    return false;
  }
  // Uninstalling leaves an orphaned empty settings record behind, so require a populated one.
  const record = prefs?.extensions?.settings?.[playwrightExtensionId];
  return !!record && typeof record === 'object' && Object.keys(record).length > 0;
}
