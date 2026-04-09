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

import fs from 'fs';
import path from 'path';

import type { MetadataWithCommitInfo } from '@testIsomorphic/types';
import type { IssueCommentEdge, Repository } from '@octokit/graphql-schema';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

type MarkdownReporterOptions = {
  configDir: string, // TODO: make it public?
  outputFile?: string;
};

class MarkdownReporter implements Reporter {
  private _options: MarkdownReporterOptions;
  private _fatalErrors: TestError[] = [];
  protected _config!: FullConfig;
  private _suite!: Suite;

  constructor(options: MarkdownReporterOptions) {
    this._options = options;
  }

  printsToStdio() {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this._config = config;
    this._suite = suite;
  }

  onError(error: TestError) {
    this._fatalErrors.push(error);
  }

  async onEnd(result: FullResult) {
    const summary = this._generateSummary();
    const lines: string[] = [];
    if (this._fatalErrors.length)
      lines.push(`**${this._fatalErrors.length} fatal errors, not part of any test**`);
    if (summary.unexpected.length) {
      lines.push(`**${summary.unexpected.length} failed**`);
      this._printTestList(':x:', summary.unexpected, lines);
    }
    if (summary.flaky.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${summary.flaky.length} flaky</b></summary>`);
      this._printTestList(':warning:', summary.flaky, lines, ' <br/>');
      lines.push(`</details>`);
      lines.push(``);
    }
    if (summary.interrupted.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>${summary.interrupted.length} interrupted</b></summary>`);
      this._printTestList(':warning:', summary.interrupted, lines, ' <br/>');
      lines.push(`</details>`);
      lines.push(``);
    }
    const skipped = summary.skipped ? `, ${summary.skipped} skipped` : '';
    const didNotRun = summary.didNotRun ? `, ${summary.didNotRun} did not run` : '';
    lines.push(`**${summary.expected} passed${skipped}${didNotRun}**`);
    lines.push(``);

    await this.publishReport(lines.join('\n'));
  }

  protected async publishReport(report: string): Promise<void> {
    const maybeRelativeFile = this._options.outputFile || 'report.md';
    const reportFile = path.resolve(this._options.configDir, maybeRelativeFile);
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.promises.writeFile(reportFile, report);
  }

  protected _generateSummary() {
    let didNotRun = 0;
    let skipped = 0;
    let expected = 0;
    const interrupted: TestCase[] = [];
    const interruptedToPrint: TestCase[] = [];
    const unexpected: TestCase[] = [];
    const flaky: TestCase[] = [];

    this._suite.allTests().forEach(test => {
      switch (test.outcome()) {
        case 'skipped': {
          if (test.results.some(result => result.status === 'interrupted')) {
            if (test.results.some(result => !!result.error))
              interruptedToPrint.push(test);
            interrupted.push(test);
          } else if (!test.results.length || test.expectedStatus !== 'skipped') {
            ++didNotRun;
          } else {
            ++skipped;
          }
          break;
        }
        case 'expected': ++expected; break;
        case 'unexpected': unexpected.push(test); break;
        case 'flaky': flaky.push(test); break;
      }
    });

    return {
      didNotRun,
      skipped,
      expected,
      interrupted,
      unexpected,
      flaky,
    };
  }

  private _printTestList(prefix: string, tests: TestCase[], lines: string[], suffix?: string) {
    for (const test of tests)
      lines.push(`${prefix} ${formatTestTitle(this._config.rootDir, test)}${suffix || ''}`);
    lines.push(``);
  }
}

function formatTestTitle(rootDir: string, test: TestCase): string {
  // root, project, file, ...describes, test
  const [, projectName, , ...titles] = test.titlePath();
  const relativeTestPath = path.relative(rootDir, test.location.file);
  // intentionally leave out column to prevent writing test.spec.ts:100:5 - GitHub turns that into 💯
  const location = `${relativeTestPath}:${test.location.line}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  const testTitle = `${projectTitle}${location} › ${titles.join(' › ')}`;
  const extraTags = test.tags.filter(t => !testTitle.includes(t));
  const formattedTags = extraTags.map(t => `\`${t}\``).join(' ');
  return `${testTitle}${extraTags.length ? ' ' + formattedTags : ''}`;
}

class GHAMarkdownReporter extends MarkdownReporter {
  private octokit: ReturnType<typeof import('@actions/github').getOctokit>;
  private context: typeof import('@actions/github').context;
  private core: typeof import('@actions/core');

  override async publishReport(report: string) {
    this.core = await import('@actions/core');
    const token = process.env.GITHUB_TOKEN || this.core.getInput('github-token');
    if (!token) {
      this.core.setFailed('Missing "github-token" input');
      throw new Error('Missing "github-token" input');
    }
    const { context, getOctokit } = await import('@actions/github');
    this.context = context;
    this.octokit = getOctokit(token);

    this.core.info('Publishing report to PR.');
    const { prNumber, prHref } = this.pullRequestFromMetadata();
    if (!prNumber) {
      this.core.info(`No PR number found, skipping GHA comment. PR href: ${prHref}`);
      return;
    }
    this.core.info(`Posting comment to PR ${prHref}`);

    const prNodeId = await this.collapsePreviousComments(prNumber);
    if (!prNodeId) {
      this.core.warning(`No PR node ID found, skipping GHA comment. PR href: ${prHref}`);
      return;
    }
    await this.addNewReportComment(prNodeId, report);
  }

  private async collapsePreviousComments(prNumber: number) {
    const { owner, repo } = this.context.repo;
    const data = await this.octokit.graphql<{ repository: Repository }>(`
      query {
        repository(owner: "${owner}", name: "${repo}") {
          pullRequest(number: ${prNumber}) {
            id
            comments(last: 100) {
              nodes {
                id
                body
                author {
                  __typename
                  login
                }
              }
            }
          }
        }
      }
    `);
    const comments = data.repository.pullRequest?.comments.nodes?.filter(comment =>
      comment?.author?.__typename === 'Bot' &&
      comment?.author?.login === 'github-actions' &&
      comment.body?.includes(this._magicComment()));
    const prId = data.repository.pullRequest?.id;
    if (!comments?.length)
      return prId;
    const mutations = comments.map((comment, i) =>
      `m${i}: minimizeComment(input: { subjectId: "${comment!.id}", classifier: OUTDATED }) { clientMutationId }`);
    await this.octokit.graphql(`
      mutation {
        ${mutations.join('\n')}
      }
    `);
    return prId;
  }

  private _magicComment() {
    return `<!-- Generated by Playwright markdown reporter for ${this._workflowRunName()} in job ${process.env.GITHUB_JOB} -->`;
  }

  private _workflowRunName() {
    // When used via 'workflow_run' event.
    const workflowRunName = this.context.payload.workflow_run?.name;
    if (workflowRunName)
      return workflowRunName;
    // When used via 'pull_request'/'push' event.
    // This is the name of the workflow file, e.g. 'ci.yml' or name if set.
    return process.env.GITHUB_WORKFLOW;
  }

  private async addNewReportComment(prNodeId: string, report: string) {
    const reportUrl = process.env.HTML_REPORT_URL;
    const mergeWorkflowUrl = `${this.context.serverUrl}/${this.context.repo.owner}/${this.context.repo.repo}/actions/runs/${this.context.runId}`;

    const body = formatComment([
      this._magicComment(),
      `### ${reportUrl ? `[Test results](${reportUrl})` : 'Test results'} for "${this._workflowRunName()}"`,
      report,
      '',
      '---',
      '',
      `Merge [workflow run](${mergeWorkflowUrl}).`
    ]);

    const response = await this.octokit.graphql<{ addComment: { commentEdge: IssueCommentEdge } }>(`
      mutation {
        addComment(input: {subjectId: "${prNodeId}", body: """${body}"""}) {
          commentEdge {
            node {
              ... on IssueComment {
                url
              }
            }
          }
        }
      }
    `);
    this.core.info(`Posted comment:  ${response.addComment.commentEdge.node?.url}`);
  }

  private pullRequestFromMetadata() {
    const metadata = this._config.metadata as MetadataWithCommitInfo;
    const prHref = metadata.ci?.prHref;
    return { prNumber: parseInt(prHref?.split('/').pop() ?? '', 10), prHref };
  }
}

function formatComment(lines: string[]) {
  let body = lines.join('\n');
  if (body.length > 65535)
    body = body.substring(0, 65000) + `... ${body.length - 65000} more characters`;
  return body;
}

export default GHAMarkdownReporter;
