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

import { envArrayToObject } from '@utils/processLauncher';

export const kFirefoxPoliciesEnvName = 'PLAYWRIGHT_FIREFOX_POLICIES_JSON';

type FirefoxPoliciesOptions = {
  env?: { name: string, value: string }[];
};

type FirefoxPolicies = {
  policies?: Record<string, unknown>;
  [key: string]: unknown;
};

export function firefoxPoliciesPath(userDataDir: string): string {
  return path.join(userDataDir, 'playwright-policies.json');
}

export async function prepareFirefoxPolicies(options: FirefoxPoliciesOptions, userDataDir: string): Promise<void> {
  const env = options.env ? envArrayToObject(options.env) : process.env;
  const userPolicies = await readFirefoxPolicies(env[kFirefoxPoliciesEnvName]);
  const policies: FirefoxPolicies = {
    ...userPolicies,
    policies: {
      ...userPolicies.policies,
      DisableAppUpdate: true,
    },
  };
  await fs.promises.writeFile(firefoxPoliciesPath(userDataDir), JSON.stringify(policies));
}

export function amendFirefoxPoliciesEnv(env: NodeJS.ProcessEnv, userDataDir: string): NodeJS.ProcessEnv {
  return {
    ...env,
    [kFirefoxPoliciesEnvName]: firefoxPoliciesPath(userDataDir),
  };
}

async function readFirefoxPolicies(policiesPath: string | undefined): Promise<FirefoxPolicies> {
  if (!policiesPath)
    return {};
  return JSON.parse(await fs.promises.readFile(policiesPath, 'utf8'));
}
