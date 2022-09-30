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

import * as fs from 'fs';
import * as path from 'path';
import { installCoverageHooks } from './coverage';
import { test } from '@playwright/test';

export type CoverageWorkerOptions = {
  coverageName?: string;
};

export const coverageTest = test.extend<{}, { __collectCoverage: void } & CoverageWorkerOptions>({
  coverageName: [undefined, { scope: 'worker', option: true  }],
  __collectCoverage: [async ({ coverageName }, run, workerInfo) => {
    if (!coverageName) {
      await run();
      return;
    }

    const { coverage, uninstall } = installCoverageHooks(coverageName);
    await run();
    uninstall();
    const coveragePath = path.join(__dirname, '..', 'coverage-report', workerInfo.workerIndex + '.json');
    const coverageJSON = Array.from(coverage.keys()).filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }, { scope: 'worker', auto: true }],
});
