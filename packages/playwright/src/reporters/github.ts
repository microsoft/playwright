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

import { ms as milliseconds } from 'playwright-core/lib/utilsBundle';
import path from 'path';
import { BaseReporter, formatError, formatFailure, stripAnsiEscapes } from './base';
import type { TestCase, FullResult, TestError } from '../../types/testReporter';

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

export class GitHubReporter extends BaseReporter {
  githubLogger = new GitHubLogger();

  printsToStdio() {
    return false;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    this._printAnnotations();
  }

  override onError(error: TestError) {
    const errorMessage = formatError(error, false).message;
    this.githubLogger.error(errorMessage);
  }

  private _printAnnotations() {
    const summary = this.generateSummary();
    const summaryMessage = this.generateSummaryMessage(summary);
    if (summary.failuresToPrint.length)
      this._printFailureAnnotations(summary.failuresToPrint);
    this._printSlowTestAnnotations();
    this._printSummaryAnnotation(summaryMessage);
  }

  private _printSlowTestAnnotations() {
    this.getSlowTests().forEach(([file, duration]) => {
      const filePath = workspaceRelativePath(path.join(process.cwd(), file));
      this.githubLogger.warning(`${filePath} took ${milliseconds(duration)}`, {
        title: 'Slow Test',
        file: filePath,
      });
    });
  }

  private _printSummaryAnnotation(summary: string){
    this.githubLogger.notice(summary, {
      title: '🎭 Playwright Run Summary'
    });
  }

  private _printFailureAnnotations(failures: TestCase[]) {
    failures.forEach((test, index) => {
      const { annotations } = formatFailure(this.config, test, {
        index: index + 1,
        includeStdio: true,
        includeAttachments: false,
      });
      annotations.forEach(({ location, title, message }) => {
        const options: GitHubLogOptions = {
          file: workspaceRelativePath(location?.file || test.location.file),
          title,
        };
        if (location) {
          options.line = location.line;
          options.col = location.column;
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
