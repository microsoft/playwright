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

import { isChromiumChannelName } from '@utils/chromiumChannels';
import { registry } from '../registry';

//   remote-debugging://<channel>[?userDataDir=<path>]
//   extension://<channel>[/<profile directory>][?userDataDir=<path>&executablePath=<path>]
// A bare channel name such as `chrome` is the same as `remote-debugging://chrome`.

export type RemoteDebuggingURL = {
  kind: 'remote-debugging';
  channel: string;
  userDataDir?: string;
};

export type ExtensionURL = {
  kind: 'extension';
  channel: string;
  profileDirectory?: string;
  userDataDir?: string;
  executablePath?: string;
};

const parametersByKind = {
  'remote-debugging': ['userDataDir'],
  'extension': ['userDataDir', 'executablePath'],
};

export function parseAttachURL(endpointURL: string): RemoteDebuggingURL | ExtensionURL | undefined {
  if (isChromiumChannelName(endpointURL))
    return { kind: 'remote-debugging', channel: endpointURL };
  const kind = (['remote-debugging', 'extension'] as const).find(kind => endpointURL.startsWith(kind + '://'));
  if (!kind)
    return undefined;

  let url: URL;
  try {
    url = new URL(endpointURL);
  } catch {
    throw new Error(`"${endpointURL}" is not a valid URL.`);
  }
  const channel = url.hostname;
  if (!registry.isChromiumAlias(channel) && registry.findExecutable(channel)?.browserName !== 'chromium')
    throw new Error(`Unknown browser channel "${channel}" in "${endpointURL}". Use a channel such as chrome or msedge.`);
  const parameters = parametersByKind[kind];
  for (const name of url.searchParams.keys()) {
    if (!parameters.includes(name))
      throw new Error(`Unknown parameter "${name}" in "${endpointURL}". The parameters of ${kind}:// are: ${parameters.join(', ')}.`);
  }
  const userDataDir = url.searchParams.get('userDataDir') || undefined;
  const profileDirectory = decodeProfileDirectory(url.pathname.replace(/^\//, ''), endpointURL);

  if (kind === 'remote-debugging') {
    if (profileDirectory)
      throw new Error(`Remote debugging connects to all profiles of the browser, so "${endpointURL}" cannot select the profile "${profileDirectory}". Use extension://${channel}/${profileDirectory} to connect to one profile.`);
    return { kind, channel, userDataDir };
  }
  if (profileDirectory && (/[\\/]/.test(profileDirectory) || profileDirectory === '..' || profileDirectory === '.'))
    throw new Error(`"${profileDirectory}" in "${endpointURL}" is not the name of a profile directory, such as Default or Profile 1.`);
  return { kind, channel, profileDirectory, userDataDir, executablePath: url.searchParams.get('executablePath') || undefined };
}

function decodeProfileDirectory(encoded: string, endpointURL: string): string | undefined {
  try {
    return decodeURIComponent(encoded) || undefined;
  } catch {
    throw new Error(`The profile directory in "${endpointURL}" is not URL-encoded correctly. Encode "%" as "%25".`);
  }
}
