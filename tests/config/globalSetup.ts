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
import { FullConfig, GlobalInfo } from '@playwright/test';

// We're dogfooding this, so the …/lib/… import is acceptable
import * as ci from '@playwright/test/lib/ci';

async function globalSetup(config: FullConfig, globalInfo: GlobalInfo) {
  const pluginResults = await Promise.all([
    ci.generationTimestamp(),
    ci.gitStatusFromCLI(config.rootDir),
    ci.githubEnv(),
  ]);

  await Promise.all(pluginResults.flat().map(attachment => globalInfo.attach(attachment.name, attachment)));
}

export default globalSetup;
