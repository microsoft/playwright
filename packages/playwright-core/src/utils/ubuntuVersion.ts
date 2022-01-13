/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import * as os from 'os';

let ubuntuVersionCached: string | undefined;

export async function getUbuntuVersion(): Promise<string> {
  if (ubuntuVersionCached === undefined)
    ubuntuVersionCached = await getUbuntuVersionAsyncInternal();
  return ubuntuVersionCached;
}

export function getUbuntuVersionSync(): string {
  if (ubuntuVersionCached === undefined)
    ubuntuVersionCached = getUbuntuVersionSyncInternal();
  return ubuntuVersionCached;
}

async function getUbuntuVersionAsyncInternal(): Promise<string> {
  if (os.platform() !== 'linux')
    return '';
  let osReleaseText = await fs.promises.readFile('/etc/upstream-release/lsb-release', 'utf8').catch(e => '');
  if (!osReleaseText)
    osReleaseText = await fs.promises.readFile('/etc/os-release', 'utf8').catch(e => '');
  if (!osReleaseText)
    return '';
  return parseUbuntuVersion(osReleaseText);
}

function getUbuntuVersionSyncInternal(): string {
  if (os.platform() !== 'linux')
    return '';
  try {
    let osReleaseText: string;
    if (fs.existsSync('/etc/upstream-release/lsb-release'))
      osReleaseText = fs.readFileSync('/etc/upstream-release/lsb-release', 'utf8');
    else
      osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
    if (!osReleaseText)
      return '';
    return parseUbuntuVersion(osReleaseText);
  } catch (e) {
    return '';
  }
}

export function parseOSReleaseText(osReleaseText: string): Map<string, string> {
  const fields = new Map();
  for (const line of osReleaseText.split('\n')) {
    const tokens = line.split('=');
    const name = tokens.shift();
    let value = tokens.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"'))
      value = value.substring(1, value.length - 1);
    if (!name)
      continue;
    fields.set(name.toLowerCase(), value);
  }
  return fields;
}

function parseUbuntuVersion(osReleaseText: string): string {
  const fields = parseOSReleaseText(osReleaseText);
  // For Linux mint
  if (fields.get('distrib_id') && fields.get('distrib_id')?.toLowerCase() === 'ubuntu')
    return fields.get('distrib_release') || '';

  if (!fields.get('name') || fields.get('name')?.toLowerCase() !== 'ubuntu')
    return '';
  return fields.get('version_id') || '';
}
