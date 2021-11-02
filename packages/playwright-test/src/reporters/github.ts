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

import path from 'path';
import { formatFailure, formatSummaryMessage, stripAnsiEscapes, summaryForSuite } from './base';
import { Reporter, TestCase, FullResult, FullConfig, Suite } from '../../types/testReporter';
import { monotonicTime } from '../util';

type GitHubLogType = 'debug' | 'notice' | 'warning' | 'error';

type GitHubLogOptions = Partial<{
  title: string;
  file: string;
  col: number;
  endColumn: number;
  line: number;
  endLine: number;
}>;

class GitHubLogger {
  private _log(message: string, type: GitHubLogType = 'notice', options: GitHubLogOptions = {}) {
    message = message.replace(/\n/g, '%0A');
    const configs = Object.entries(options)
        .map(([key, option]) => `${key}=${option}`)
        .join(',');
    console.log(stripAnsiEscapes(`::${type} ${configs}::${message}`));
  }

  debug(message: string, options?: GitHubLogOptions) {
    this._log(message, 'debug', options);
  }

  error(message: string, options?: GitHubLogOptions) {
    this._log(message, 'error', options);
  }

  notice(message: string, options?: GitHubLogOptions) {
    this._log(message, 'notice', options);
  }

  warning(message: string, options?: GitHubLogOptions) {
    this._log(message, 'warning', options);
  }
}

export class GitHubReporter implements Reporter {
  githubLogger = new GitHubLogger();
  config!: FullConfig;
  suite!: Suite;
  monotonicStartTime: number = 0;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
    this.monotonicStartTime = monotonicTime();
  }

  async onEnd(result: FullResult) {
    const duration = monotonicTime() - this.monotonicStartTime;
    const summary = summaryForSuite(this.suite);
    const summaryMessage = formatSummaryMessage(this.config, summary, duration);
    if (summary.failuresToPrint.length)
      this._printFailureAnnotations(summary.failuresToPrint);
    this._printSummaryAnnotation(summaryMessage);
  }

  private _printSummaryAnnotation(summary: string){
    this.githubLogger.notice(summary, {
      title: '🎭 Playwright Run Summary'
    });
  }

  private _printFailureAnnotations(failures: TestCase[]) {
    failures.forEach((test, index) => {
      const filePath = workspaceRelativePath(test.location.file);
      const { annotations } = formatFailure(this.config, test, {
        filePath,
        index: index + 1,
        includeStdio: true,
        includeAttachments: false,
      });
      annotations.forEach(({ filePath, title, message, position }) => {
        const options: GitHubLogOptions = {
          file: filePath,
          title,
        };
        if (position) {
          options.line = position.line;
          options.col = position.column;
        }
        this.githubLogger.error(message, options);
      });
    });
  }
}

function workspaceRelativePath(filePath: string): string {
  return path.relative(process.env['GITHUB_WORKSPACE'] ?? '', filePath);
}

export default GitHubReporter;
