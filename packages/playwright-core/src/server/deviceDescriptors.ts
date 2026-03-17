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

import deviceDescriptorsSource from './deviceDescriptorsSource.json';

import type { Devices } from './types';

function platformTag(): string {
  switch (process.platform) {
    case 'darwin': return 'Macintosh; Intel Mac OS X 10_15_7';
    case 'linux': return 'X11; Linux x86_64';
    default: return 'Windows NT 10.0; Win64; x64';
  }
}

function resolveDescriptors(source: Devices): Devices {
  const platform = platformTag();
  const result: Devices = {};
  for (const [name, descriptor] of Object.entries(source)) {
    if (descriptor.userAgent.includes('{{platform}}'))
      result[name] = { ...descriptor, userAgent: descriptor.userAgent.replace('{{platform}}', platform) };
    else
      result[name] = descriptor;
  }
  return result;
}

export const deviceDescriptors = resolveDescriptors(deviceDescriptorsSource as Devices);
