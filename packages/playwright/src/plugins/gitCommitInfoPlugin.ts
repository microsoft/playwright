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

import { createGuid, spawnAsync } from 'playwright-core/lib/utils';

import type { TestRunnerPlugin } from './';
import type { FullConfig } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { GitCommitInfo } from '../isomorphic/types';

const GIT_OPERATIONS_TIMEOUT_MS = 1500;

export const addGitCommitInfoPlugin = (fullConfig: FullConfigInternal) => {
  const commitProperty = fullConfig.config.metadata['git.commit.info'];
  if (commitProperty && typeof commitProperty === 'object' && Object.keys(commitProperty).length === 0)
    fullConfig.plugins.push({ factory: gitCommitInfo });
};

export const gitCommitInfo = (options?: GitCommitInfoPluginOptions): TestRunnerPlugin => {
  return {
    name: 'playwright:git-commit-info',

    setup: async (config: FullConfig, configDir: string) => {
      const commitInfo = await linksFromEnv();
      await enrichStatusFromCLI(options?.directory || configDir, commitInfo);
      config.metadata = config.metadata || {};
      config.metadata['git.commit.info'] = commitInfo;
    },
  };
};

interface GitCommitInfoPluginOptions {
  directory?: string;
}

async function linksFromEnv(): Promise<GitCommitInfo> {
  const out: GitCommitInfo = {};
  // Jenkins: https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#using-environment-variables
  if (process.env.BUILD_URL) {
    out.ci = out.ci || {};
    out.ci.link = process.env.BUILD_URL;
  }
  // GitLab: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  if (process.env.CI_PROJECT_URL && process.env.CI_COMMIT_SHA) {
    out.revision = out.revision || {};
    out.revision.link = `${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`;
  }
  if (process.env.CI_JOB_URL) {
    out.ci = out.ci || {};
    out.ci.link = process.env.CI_JOB_URL;
  }
  // GitHub: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA) {
    out.revision = out.revision || {};
    out.revision.link = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`;
  }
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
    out.ci = out.ci || {};
    out.ci.link = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  }
  if (process.env.GITHUB_EVENT_PATH) {
    try {
      const json = JSON.parse(await fs.promises.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
      if (json.pull_request) {
        out.pull_request = out.pull_request || {};
        out.pull_request.title = json.pull_request.title;
        out.pull_request.link = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/pull/${json.pull_request.number}`;
        out.pull_request.base = json.pull_request.base.ref;
      }
    } catch {
    }
  }
  return out;
}

async function enrichStatusFromCLI(gitDir: string, commitInfo: GitCommitInfo) {
  const separator = `:${createGuid().slice(0, 4)}:`;
  const commitInfoResult = await spawnAsync(
      'git',
      ['show', '-s', `--format=%H${separator}%s${separator}%an${separator}%ae${separator}%ct`, 'HEAD'],
      { stdio: 'pipe', cwd: gitDir, timeout: GIT_OPERATIONS_TIMEOUT_MS }
  );
  if (commitInfoResult.code)
    return;
  const showOutput = commitInfoResult.stdout.trim();
  const [id, subject, author, email, rawTimestamp] = showOutput.split(separator);
  let timestamp: number = Number.parseInt(rawTimestamp, 10);
  timestamp = Number.isInteger(timestamp) ? timestamp * 1000 : 0;

  commitInfo.revision = {
    ...commitInfo.revision,
    id,
    author,
    email,
    subject,
    timestamp,
  };

  const diffLimit = 1_000_000; // 1MB
  if (commitInfo.pull_request?.base) {
    const pullDiffResult = await spawnAsync(
        'git',
        ['diff', commitInfo.pull_request?.base],
        { stdio: 'pipe', cwd: gitDir, timeout: GIT_OPERATIONS_TIMEOUT_MS }
    );
    if (!pullDiffResult.code)
      commitInfo.pull_request!.diff = pullDiffResult.stdout.substring(0, diffLimit);
  } else {
    const diffResult = await spawnAsync(
        'git',
        ['diff', 'HEAD~1'],
        { stdio: 'pipe', cwd: gitDir, timeout: GIT_OPERATIONS_TIMEOUT_MS }
    );
    if (!diffResult.code)
      commitInfo.revision!.diff = diffResult.stdout.substring(0, diffLimit);
  }
}
