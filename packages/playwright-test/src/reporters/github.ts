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
import { githubActionsCore } from '../utilsBundle';

type GitHubLogType = 'debug' | 'notice' | 'warning' | 'error';

type GitHubLogOptions = Partial<{
  title: string;
  file: string;
  col: number;
  endColumn: number;
  line: number;
  endLine: number;
}>;

const OUTCOME_PRECEDENCE: ReturnType<TestCase['outcome']>[] = ['unexpected', 'flaky', 'expected', 'skipped'];
const PROBLEMATIC_OUTCOMES: ReturnType<TestCase['outcome']>[] = ['unexpected', 'flaky'];

const sort = (tests: TestCase[]) => {
  const out = [...tests];

  return out.sort((a, b) => {
    const aOutcome = OUTCOME_PRECEDENCE.indexOf(a.outcome());
    const bOutcome = OUTCOME_PRECEDENCE.indexOf(b.outcome());
    if (aOutcome !== bOutcome)
      return aOutcome < bOutcome ? -1 : 1;
    return a.titlePath().join(' :: ').localeCompare(b.titlePath().join(' :: '));
  });
};

const outcomeToEmoji = (o: ReturnType<TestCase['outcome']>) => {
  switch (o) {
    case 'expected':
      return '✅';
    case 'flaky':
      return '⁉️';
    case 'unexpected':
      return '❌';
    case 'skipped':
      return '⏩';
  }

  throw new Error('unreachable');
};

type Options = { annotations?: 'on' | 'off', summary?: 'on' | 'off' | 'problematic-only' };

function escapeHTML(text: string): string {
  return text.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!));
}
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
  private _githubLogger = new GitHubLogger();
  private _options: Options = { annotations: 'on', summary: 'on' };

  constructor(options?: Options) {
    super();
    this._options = { ...this._options, ...options };
  }

  printsToStdio() {
    return false;
  }

  override async onEnd(result: FullResult) {
    super.onEnd(result);
    if (this._options.annotations !== 'off')
      this._printAnnotations();
    if (this._options.summary !== 'off')
      await this._writeGHASummary();
  }

  override onError(error: TestError) {
    const errorMessage = formatError(this.config, error, false).message;
    this._githubLogger.error(errorMessage);
  }

  private async _writeGHASummary() {
    const cases = this.suite.allTests();
    let header = 'Tests';
    let testsToShowDetailsFor = cases;
    if (this._options.summary === 'problematic-only') {
      header = 'Problematic Tests';
      testsToShowDetailsFor = cases.filter(t => PROBLEMATIC_OUTCOMES.includes(t.outcome()));
    }

    await githubActionsCore.summary
        .addHeading('Playwright Test')
        .addHeading('Summary', 2)
        .addTable([[{ data: 'Status', header: true }, { data: 'Count', header: true }],
          ...OUTCOME_PRECEDENCE.map(o => ([`${outcomeToEmoji(o)} (${o})`, cases.filter(t => t.outcome() === o).length.toString()])),
          ['<strong>Total</strong>', cases.length.toString()],
        ])
        .addHeading(header, 2)
        .addTable([
          [{ data: 'Status', header: true }, { data: 'Spec', header: true }, { data: 'Error', header: true }],
          ...sort(testsToShowDetailsFor).map(t => ([outcomeToEmoji(t.outcome()), t.titlePath().splice(1).join(' > '), t.results.some(r => r.error) ? `<details><summary>Expand for Error Logs</summary> <pre>${escapeHTML(stripAnsiEscapes(formatFailure(this.config, t).message))}</pre></details>` : ''])),
        ])
        .write();
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
      this._githubLogger.warning(`${filePath} took ${milliseconds(duration)}`, {
        title: 'Slow Test',
        file: filePath,
      });
    });
  }

  private _printSummaryAnnotation(summary: string){
    this._githubLogger.notice(summary, {
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
        this._githubLogger.error(message, options);
      });
    });
  }
}

function workspaceRelativePath(filePath: string): string {
  return path.relative(process.env['GITHUB_WORKSPACE'] ?? '', filePath);
}

export default GitHubReporter;
