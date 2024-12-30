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

import type {
  FullConfig, FullResult, Reporter, Suite
} from '@playwright/test/reporter';
import { stripAnsi } from '../config/utils';
import fs from 'fs';
import path from 'path';


type ReporterOptions = {
  outputFile?: string,
  configDir: string,
};

class CsvReporter implements Reporter {
  private _suite: Suite;
  private _options: ReporterOptions;
  private _pendingWrite: Promise<void>;

  constructor(options: ReporterOptions) {
    this._options = options;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this._suite = suite;
  }

  onEnd(result: FullResult) {
    const rows = [['File Name', 'Test Name', 'Expected Status', 'Status', 'Error Message']];
    for (const project of this._suite.suites) {
      for (const file of project.suites) {
        for (const test of file.allTests()) {
          if (test.ok())
            continue;
          const row = [];
          row.push(file.title);
          row.push(csvEscape(test.title));
          row.push(test.expectedStatus);
          row.push(test.outcome());
          const result = test.results.find(r => r.error);
          const errorMessage = stripAnsi(result?.error?.message.replace(/\s+/g, ' ').trim().substring(0, 1024));
          row.push(csvEscape(errorMessage ?? ''));
          rows.push(row);
        }
      }
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const reportFile = path.resolve(this._options.configDir, this._options.outputFile || 'test-results.csv');
    this._pendingWrite = fs.promises.writeFile(reportFile, csv);
  }

  async onExit() {
    await this._pendingWrite;
  }

  printsToStdio(): boolean {
    return false;
  }
}

function csvEscape(str) {
  if (str.includes('"') || str.includes(',') || str.includes('\n'))
    return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default CsvReporter;
