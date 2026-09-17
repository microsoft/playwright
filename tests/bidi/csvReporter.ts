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
  markdownFile?: string,
  configDir: string,
};

const header = ['Test Name', 'Expected Status', 'Status', 'Error Message'];

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
    const rows: string[][] = [];
    for (const project of this._suite.suites) {
      for (const file of project.suites) {
        for (const test of file.allTests()) {
          // Report fixme tests as failing.
          const fixme = test.annotations.find(a => a.type === 'fixme');
          if (test.ok() && !fixme)
            continue;
          const row = [];
          const [, , , ...titles] = test.titlePath();
          row.push(`${file.title} › ${titles.join(' › ')}`);
          row.push(test.expectedStatus);
          row.push(test.outcome());
          if (fixme) {
            row.push('fixme' + (fixme.description ? `: ${fixme.description.replace(/\s+/g, ' ')}` : ''));
          } else {
            const result = test.results.find(r => r.error);
            if (result) {
              const errorMessage = stripAnsi(result.error?.message.replace(/\s+/g, ' ').trim().substring(0, 1024) ?? '');
              row.push(errorMessage);
            } else {
              const fail = test.annotations.find(a => a.type === 'fail');
              if (fail)
                row.push(`Should have failed: ${fail.description}`);
              else
                row.push('');
            }
          }
          rows.push(row);
        }
      }
    }
    const reportFile = path.resolve(this._options.configDir, this._options.outputFile || 'test-results.csv');
    const markdownFile = this._options.markdownFile && path.resolve(this._options.configDir, this._options.markdownFile);
    this._pendingWrite = (async () => {
      await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
      const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
      await fs.promises.writeFile(reportFile, csv);
      if (markdownFile) {
        await fs.promises.mkdir(path.dirname(markdownFile), { recursive: true });
        await fs.promises.writeFile(markdownFile, markdownTable(rows));
      }
    })();
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

// GitHub job summaries are capped at 1MiB, so keep the rendered table bounded.
const maxMarkdownRows = 500;

function markdownTable(rows: string[][]): string {
  const lines = [
    `### ${rows.length} failing tests`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.slice(0, maxMarkdownRows).map(row => `| ${row.map(markdownEscape).join(' | ')} |`),
  ];
  if (rows.length > maxMarkdownRows)
    lines.push('', `_...and ${rows.length - maxMarkdownRows} more, see the csv report._`);
  return lines.join('\n') + '\n';
}

function markdownEscape(str: string): string {
  return str.replace(/[\\|`<>]/g, c => '\\' + c);
}

export default CsvReporter;
