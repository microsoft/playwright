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

import milliseconds from 'ms';
import path from 'path';
import { BaseReporter, formatFailure } from './base';
import { TestCase, FullResult } from '../../../types/testReporter';

type GithubLogType = 'debug' | 'notice' | 'warning' | 'error';

type GithubLogOptions = Partial<{
  title: string;
  file: string;
  col: number;
  endColumn: number;
  line: number;
  endLine: number;
}>;

class GithubLogger {
  private _isGithubAction: boolean = !!process.env.GITHUB_ACTION;

  private _log(message: string, type: GithubLogType = 'notice', options: GithubLogOptions = {}) {
    if (this._isGithubAction)
      message = message.replace(/\n/g, '%0A');
    const configs = Object.entries(options)
        .map(([key, option]) => `${key}=${option}`)
        .join(',');
    console.log(`::${type} ${configs}::${message}`);
  }

  debug(message: string, options?: GithubLogOptions) {
    this._log(message, 'debug', options);
  }

  error(message: string, options?: GithubLogOptions) {
    this._log(message, 'error', options);
  }

  notice(message: string, options?: GithubLogOptions) {
    this._log(message, 'notice', options);
  }

  warning(message: string, options?: GithubLogOptions) {
    this._log(message, 'warning', options);
  }
}

export class GithubReporter extends BaseReporter {
  githubLogger = new GithubLogger();

  override async onEnd(result: FullResult) {
    super.onEnd(result);
    this.epilogue(true);
  }

  protected override printSlowTests() {
    this.getSlowTests().forEach(([file, duration]) => {
      const filePath = workspaceRelativePath(path.join(process.cwd(), file));
      this.githubLogger.warning(`${filePath} (${milliseconds(duration)})`, {
        title: 'Slow Test',
        file: filePath,
      });
    });
  }

  protected override printSummary(summary: string){
    this.githubLogger.notice(summary, {
      title: '🎭 Playwright Run Summary'
    });
  }

  protected override printFailures(failures: TestCase[]) {
    failures.forEach((test, index) => {
      const filePath = workspaceRelativePath(test.location.file);
      const { annotations } = formatFailure(this.config, test, {
        filePath,
        index: index + 1,
        includeStdio: true,
        includeAttachments: false,
      });
      annotations.forEach(({ filePath, title, message, position }) => {
        const options: GithubLogOptions = {
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

export default GithubReporter;
