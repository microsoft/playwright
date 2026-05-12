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

let didFailToReadOSRelease = false;
let osRelease: {
  id: string,
  idLike: string[],
  version: string,
} | undefined;

export function getLinuxDistributionInfoSync(): { id: string, idLike: string[], version: string } | undefined {
  if (process.platform !== 'linux')
    return undefined;
  if (!osRelease && !didFailToReadOSRelease) {
    try {
      // List of /etc/os-release values for different distributions could be
      // found here: https://gist.github.com/aslushnikov/8ceddb8288e4cf9db3039c02e0f4fb75
      const osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osRelease = {
        id: fields.get('id') ?? '',
        idLike: (fields.get('id_like') ?? '').split(/\s+/).filter(Boolean),
        version: fields.get('version_id') ?? '',
      };
    } catch (e) {
      didFailToReadOSRelease = true;
    }
  }
  return osRelease;
}

// Distributions that use dnf as their package manager. Covers Fedora and the
// RHEL family (RHEL, CentOS Stream, Rocky, Alma, Oracle, Amazon Linux 2023).
const DNF_DISTRO_IDS = new Set(['fedora', 'rhel', 'centos', 'rocky', 'almalinux', 'ol', 'amzn']);

export function isDnfBasedDistroSync(): boolean {
  const info = getLinuxDistributionInfoSync();
  if (!info)
    return false;
  if (DNF_DISTRO_IDS.has(info.id))
    return true;
  return info.idLike.some(id => DNF_DISTRO_IDS.has(id));
}

function parseOSReleaseText(osReleaseText: string): Map<string, string> {
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
