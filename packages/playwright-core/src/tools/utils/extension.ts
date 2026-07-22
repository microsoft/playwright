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

export async function findPlaywrightExtensionProfile(userDataDir: string): Promise<string | undefined> {
  const profiles = await listProfileDirectories(userDataDir);
  const lastUsed = await readLastUsedProfile(userDataDir);
  const ordered = lastUsed && profiles.includes(lastUsed)
    ? [lastUsed, ...profiles.filter(profile => profile !== lastUsed)]
    : profiles;
  for (const profile of ordered) {
    if (await isExtensionInstalledInProfile(path.join(userDataDir, profile)))
      return profile;
  }
  return undefined;
}

async function listProfileDirectories(userDataDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.promises.readdir(userDataDir);
  } catch {
    return [];
  }
  const profiles = entries.filter(entry => entry === 'Default' || /^Profile \d+$/.test(entry));
  profiles.sort((a, b) => profileRank(a) - profileRank(b));
  return profiles;
}

function profileRank(profile: string): number {
  return profile === 'Default' ? -1 : parseInt(profile.slice('Profile '.length), 10);
}

async function readLastUsedProfile(userDataDir: string): Promise<string | undefined> {
  try {
    const localState = JSON.parse(await fs.promises.readFile(path.join(userDataDir, 'Local State'), 'utf-8'));
    const lastUsed = localState?.profile?.last_used;
    return typeof lastUsed === 'string' ? lastUsed : undefined;
  } catch {
    return undefined;
  }
}

export async function isPlaywrightExtensionInstalled(userDataDir: string): Promise<boolean> {
  return await findPlaywrightExtensionProfile(userDataDir) !== undefined;
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
