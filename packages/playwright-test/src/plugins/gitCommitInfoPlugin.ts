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
import type { PlaywrightTestConfig, TestPlugin } from '../types';
import { createGuid } from 'playwright-core/lib/utils';
import { spawnAsync } from 'playwright-core/lib/utils/spawnAsync';

const GIT_OPERATIONS_TIMEOUT_MS = 1500;

export const gitCommitInfo = (options?: GitCommitInfoPluginOptions): TestPlugin => {
  return {
    name: 'playwright-git-commit-info-plugin',

    configure: async (config: PlaywrightTestConfig, configDir: string) => {
      options = options || {};
      let revision: Partial<Revision> | undefined = options.revision;
      if (shouldRunGit(options.revision, options.mode)) {
        revision = {
          ...await gitStatusFromCLI(options.directory || configDir),
          ...revision,
        };
      }
      const links = linksFromEnv();
      // Merge it all together minding the order of precedence
      // Be sure to mutate the config passed in and not return a new copy
      config.metadata = config.metadata || {};
      config.metadata.generatedAt = config.metadata?.generatedAt ?? Date.now();
      config.metadata.revision = {
        ...config.metadata?.revision,
        link: links.revision,
        ...revision,
      };
      config.metadata.ci = {
        ...config.metadata?.ci,
        link: links.ci,
        ...options.ci,
      };

      // Normalize dates
      const timestamp = config.metadata.revision?.timestamp;
      if (timestamp instanceof Date)
        config.metadata.revision.timestamp = timestamp.getTime();

    },
  };
};

export type GitCommitInfoPluginOptions = {
    mode?: 'disable-cli',
    directory?: string,
    revision?: Partial<Revision>,
    ci?: Partial<CI>,
};

interface Revision {
    id: string;
    author: string;
    email: string;
    subject: string;
    timestamp: number | Date;
    link: string;
}

interface CI {
    link: string;
}

const shouldRunGit = (revision: Partial<Revision> | undefined, mode: GitCommitInfoPluginOptions['mode']) => {
  return mode !== 'disable-cli' && (
    !revision ||
        revision.id === undefined ||
        revision.author === undefined ||
        revision.subject === undefined ||
        revision.timestamp === undefined ||
        revision.link === undefined
  );
};

const linksFromEnv = () => {
  const out: { revision?: string, ci?: string } = {};
  // Jenkins: https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#using-environment-variables
  if (process.env.BUILD_URL)
    out.ci = process.env.BUILD_URL;
  // GitLab: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  if (process.env.CI_PROJECT_URL && process.env.CI_COMMIT_SHA)
    out.revision = `${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`;
  if (process.env.CI_JOB_URL)
    out.ci = process.env.CI_JOB_URL;
    // GitHub: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA)
    out.revision = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`;
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID)
    out.ci = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  return out;
};

export const gitStatusFromCLI = async (gitDir: string): Promise<Omit<Revision, 'link'> | undefined> => {
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
    id,
    author,
    email,
    subject,
    timestamp,
  };
};
