/**
 * Copyright Microsoft Corporation. All rights reserved.
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
import path from 'path';
import type { FullResult, Suite } from '../../types/testReporter';
import { filterProjects } from './projectUtils';
import type { FullConfigInternal } from '../common/config';
import type { ReporterV2 } from '../reporters/reporterV2';

type LastRunInfo = {
  status: FullResult['status'];
  failedTests: string[];
};

export class LastRunReporter implements ReporterV2 {
  private _config: FullConfigInternal;
  private _lastRunFile: string | undefined;
  private _suite: Suite | undefined;

  constructor(config: FullConfigInternal) {
    this._config = config;
    const [project] = filterProjects(config.projects, config.cliProjectFilter);
    if (project)
      this._lastRunFile = path.join(project.project.outputDir, '.last-run.json');
  }

  async filterLastFailed() {
    if (!this._lastRunFile)
      return;
    try {
      const lastRunInfo = JSON.parse(await fs.promises.readFile(this._lastRunFile, 'utf8')) as LastRunInfo;
      this._config.testIdMatcher = id => lastRunInfo.failedTests.includes(id);
    } catch {
    }
  }

  version(): 'v2' {
    return 'v2';
  }

  printsToStdio() {
    return false;
  }

  onBegin(suite: Suite) {
    this._suite = suite;
  }

  async onEnd(result: FullResult) {
    if (!this._lastRunFile || this._config.cliListOnly)
      return;
    await fs.promises.mkdir(path.dirname(this._lastRunFile), { recursive: true });
    const failedTests = this._suite?.allTests().filter(t => !t.ok()).map(t => t.id);
    const lastRunReport = JSON.stringify({ status: result.status, failedTests }, undefined, 2);
    await fs.promises.writeFile(this._lastRunFile, lastRunReport);
  }
}
