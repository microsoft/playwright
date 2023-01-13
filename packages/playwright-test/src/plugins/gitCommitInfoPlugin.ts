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

const GIT_OPERATIONS_TIMEOUT_MS = 1500;

export const gitCommitInfo = (options?: GitCommitInfoPluginOptions): TestRunnerPlugin => {
  return {
    name: 'playwright:git-commit-info',

    setup: async (config: FullConfig, configDir: string) => {
      const info = {
        ...linksFromEnv(),
        ...options?.info ? options.info : await gitStatusFromCLI(options?.directory || configDir),
        timestamp: Date.now(),
      };
      // Normalize dates
      const timestamp = info['revision.timestamp'];
      if (timestamp instanceof Date)
        info['revision.timestamp'] = timestamp.getTime();

      config.metadata = config.metadata || {};
      Object.assign(config.metadata, info);
    },
  };
};

export interface GitCommitInfoPluginOptions {
    directory?: string;
    info?: Info;
}

export interface Info {
  'revision.id'?: string;
  'revision.author'?: string;
  'revision.email'?: string;
  'revision.subject'?: string;
  'revision.timestamp'?: number | Date;
  'revision.link'?: string;
  'ci.link'?: string;
}

const linksFromEnv = (): Pick<Info, 'revision.link' | 'ci.link'> => {
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
};

export const gitStatusFromCLI = async (gitDir: string): Promise<Info | undefined> => {
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
};
