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

// The server has the same check in server/chromium/crExtensionProfile.ts, because tools and the server
// cannot import each other. Keep the two checks the same.

// Also pinned via the "key" field in packages/extension/manifest.json.
export const playwrightExtensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';

export const playwrightExtensionInstallUrl = `https://chromewebstore.google.com/detail/playwright-extension/${playwrightExtensionId}`;

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

async function readLocalStateProfile(userDataDir: string): Promise<any> {
  try {
    const localState = JSON.parse(await fs.promises.readFile(path.join(userDataDir, 'Local State'), 'utf-8'));
    return localState?.profile;
  } catch {
    return undefined;
  }
}

export type BrowserProfile = {
  dirName: string;
  name: string;
  extensionInstalled: boolean;
};

export async function listBrowserProfiles(userDataDir: string): Promise<BrowserProfile[]> {
  const [dirNames, localStateProfile] = await Promise.all([
    listProfileDirectories(userDataDir),
    readLocalStateProfile(userDataDir),
  ]);
  return await Promise.all(dirNames.map(async dirName => ({
    dirName,
    name: profileDisplayName(localStateProfile?.info_cache?.[dirName]) ?? dirName,
    extensionInstalled: await isExtensionInstalledInProfile(path.join(userDataDir, dirName)),
  })));
}

function profileDisplayName(info: any): string | undefined {
  const name = nonEmptyString(info?.name);
  const email = nonEmptyString(info?.user_name);
  if (!email)
    return name;
  const accountName = nonEmptyString(info?.gaia_name) ?? name;
  return accountName ? `${accountName} (${email})` : email;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

export async function isExtensionInstalledInProfile(profileDir: string): Promise<boolean> {
  // Web store installs unpack into <profile>/Extensions/<id>; `--load-extension` only
  // leaves a settings record in the preferences.
  if (await pathExists(path.join(profileDir, 'Extensions', playwrightExtensionId)))
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

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
