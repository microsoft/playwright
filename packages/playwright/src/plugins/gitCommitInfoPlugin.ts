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

import { createGuid, spawnAsync } from 'playwright-core/lib/utils';
import type { TestRunnerPlugin } from './';
import type { FullConfig } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { GitCommitInfo } from '../isomorphic/types';

const GIT_OPERATIONS_TIMEOUT_MS = 1500;

export const addGitCommitInfoPlugin = (fullConfig: FullConfigInternal) => {
  if (fullConfig.populateGitInfo)
    fullConfig.plugins.push({ factory: gitCommitInfo });
};

export const gitCommitInfo = (options?: GitCommitInfoPluginOptions): TestRunnerPlugin => {
  return {
    name: 'playwright:git-commit-info',

    setup: async (config: FullConfig, configDir: string) => {
      const fromEnv = linksFromEnv();
      const fromCLI = await gitStatusFromCLI(options?.directory || configDir);
      const info = { ...fromEnv, ...fromCLI };
      if (info['revision.timestamp'] instanceof Date)
        info['revision.timestamp'] = info['revision.timestamp'].getTime();

      config.metadata = config.metadata || {};
      config.metadata['git.commit.info'] = info;
    },
  };
};

interface GitCommitInfoPluginOptions {
  directory?: string;
}

function linksFromEnv(): Pick<GitCommitInfo, 'revision.link' | 'ci.link'> {
  const out: { 'revision.link'?: string; 'ci.link'?: string; } = {};
  // Jenkins: https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#using-environment-variables
  if (process.env.BUILD_URL)
    out['ci.link'] = process.env.BUILD_URL;
  // GitLab: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  if (process.env.CI_PROJECT_URL && process.env.CI_COMMIT_SHA)
    out['revision.link'] = `${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`;
  if (process.env.CI_JOB_URL)
    out['ci.link'] = process.env.CI_JOB_URL;
    // GitHub: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA)
    out['revision.link'] = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`;
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID)
    out['ci.link'] = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  return out;
}

async function gitStatusFromCLI(gitDir: string): Promise<GitCommitInfo | undefined> {
  const separator = `:${createGuid().slice(0, 4)}:`;
  const { code, stdout } = await spawnAsync(
      'git',
      ['show', '-s', `--format=%H${separator}%s${separator}%an${separator}%ae${separator}%ct`, 'HEAD'],
      { stdio: 'pipe', cwd: gitDir, timeout: GIT_OPERATIONS_TIMEOUT_MS }
  );
  if (code)
    return;
  const showOutput = stdout.trim();
  const [id, subject, author, email, rawTimestamp] = showOutput.split(separator);
  let timestamp: number = Number.parseInt(rawTimestamp, 10);
  timestamp = Number.isInteger(timestamp) ? timestamp * 1000 : 0;

  return {
    'revision.id': id,
    'revision.author': author,
    'revision.email': email,
    'revision.subject': subject,
    'revision.timestamp': timestamp,
  };
}
