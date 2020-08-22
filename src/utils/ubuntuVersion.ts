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

import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';

const readFileAsync = util.promisify(fs.readFile.bind(fs));

export async function getUbuntuVersion(): Promise<string> {
  if (os.platform() !== 'linux')
    return '';
  const osReleaseText = await readFileAsync('/etc/os-release', 'utf8').catch(e => '');
  if (!osReleaseText)
    return '';
  return getUbuntuVersionInternal(osReleaseText);
}

export function getUbuntuVersionSync(): string {
  if (os.platform() !== 'linux')
    return '';
  try {
    const osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
    if (!osReleaseText)
      return '';
    return getUbuntuVersionInternal(osReleaseText);
  } catch (e) {
    return '';
  }
}

function getUbuntuVersionInternal(osReleaseText: string): string {
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
  if (!fields.get('name') || fields.get('name').toLowerCase() !== 'ubuntu')
    return '';
  return fields.get('version_id') || '';
}
