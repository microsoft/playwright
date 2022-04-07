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
import type { FullConfig } from '@playwright/test';

// We're dogfooding this, so the …/lib/… import is acceptable
import * as ci from '@playwright/test/lib/ci';

async function globalSetup(config: FullConfig) {
  (config as any)._attachments = [
    ...await ci.generationTimestamp(),
    ...await ci.gitStatusFromCLI(config.rootDir),
    ...await ci.githubEnv(),
    // In the future, we would add some additional plugins like:
    // ...await ci.azurePipelinePlugin(),
    // (and these would likley all get bundled into one call and controlled with one config instead
    // of manually manipulating the attachments array)
  ];
}

export default globalSetup;
