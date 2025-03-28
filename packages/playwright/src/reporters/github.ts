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

import { noColors } from 'playwright-core/lib/utils';
import { ms as milliseconds } from 'playwright-core/lib/utilsBundle';

import { TerminalReporter, formatResultFailure, formatRetry } from './base';
import { stripAnsiEscapes } from '../util';

import type { FullResult, TestCase, TestError } from '../../types/testReporter';

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

export class GitHubReporter extends TerminalReporter {
  githubLogger = new GitHubLogger();

  constructor(options: { omitFailures?: boolean } = {}) {
    super(options);
    this.screen = { ...this.screen, colors: noColors };
  }

  printsToStdio() {
    return false;
  }

  override async onEnd(result: FullResult) {
    await super.onEnd(result);
    this._printAnnotations();
  }

  override onError(error: TestError) {
    const errorMessage = this.formatError(error).message;
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
      const title = this.formatTestTitle(test);
      const header = this.formatTestHeader(test, { indent: '  ', index: index + 1, mode: 'error' });
      for (const result of test.results) {
        const errors = formatResultFailure(this.screen, test, result, '    ');
        for (const error of errors) {
          const options: GitHubLogOptions = {
            file: workspaceRelativePath(error.location?.file || test.location.file),
            title,
          };
          if (error.location) {
            options.line = error.location.line;
            options.col = error.location.column;
          }
          const message = [header, ...formatRetry(this.screen, result), error.message].join('\n');
          this.githubLogger.error(message, options);
        }
      }
    });
  }
}

function workspaceRelativePath(filePath: string): string {
  return path.relative(process.env['GITHUB_WORKSPACE'] ?? '', filePath);
}

export default GitHubReporter;
