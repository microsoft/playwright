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

import { errorWithFile } from '../util';

import type { FullResult, Suite, TestCase } from '../../types/testReporter';
import type { config as commonConfig } from '../common';
import type { ReporterV2 } from '../reporters/reporterV2';

type LastRunInfo = {
  status: FullResult['status'];
  failedTests: string[];
};

function didNotRun(test: TestCase): boolean {
  if (test.outcome() !== 'skipped')
    return false;
  if (test.results.some(result => result.status === 'interrupted'))
    return false;
  return !test.results.length || test.expectedStatus !== 'skipped';
}

export class LastRunReporter implements ReporterV2 {
  private _inputFile: string | undefined;
  private _isDefaultInputFile: boolean;
  private _outputFile: string | undefined;
  private _suite: Suite | undefined;
  private _listMode: boolean;

  constructor(filteredProjects: commonConfig.FullProjectInternal[], options: { listMode?: boolean, inputFile?: string, outputFile?: string }) {
    this._listMode = !!options.listMode;
    const [project] = filteredProjects;
    const defaultFile = project ? path.join(project.project.outputDir, '.last-run.json') : undefined;
    const outputFile = options.outputFile ?? process.env.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE;
    this._outputFile = outputFile ? path.resolve(process.cwd(), outputFile) : defaultFile;
    this._inputFile = options.inputFile ? path.resolve(process.cwd(), options.inputFile) : defaultFile;
    this._isDefaultInputFile = !options.inputFile;
  }

  async filterLastFailed(): Promise<string[] | undefined> {
    if (!this._inputFile)
      return undefined;
    try {
      return await readFailedTests(this._inputFile);
    } catch (e) {
      if (this._isDefaultInputFile)
        return undefined;
      throw e;
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
    if (!this._outputFile || this._listMode)
      return;
    const lastRunInfo: LastRunInfo = {
      status: result.status,
      failedTests: this._suite?.allTests().filter(t => !t.ok() || didNotRun(t)).map(t => t.id) || [],
    };
    await fs.promises.mkdir(path.dirname(this._outputFile), { recursive: true });
    await fs.promises.writeFile(this._outputFile, JSON.stringify(lastRunInfo, undefined, 2));
  }
}

async function readFailedTests(file: string): Promise<string[]> {
  let lastRunInfo: LastRunInfo;
  try {
    lastRunInfo = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  } catch (e) {
    throw errorWithFile(file, 'Cannot read last run file: ' + e.message);
  }
  if (!Array.isArray(lastRunInfo?.failedTests))
    throw errorWithFile(file, 'Cannot read last run file: "failedTests" list is missing');
  return lastRunInfo.failedTests;
}
