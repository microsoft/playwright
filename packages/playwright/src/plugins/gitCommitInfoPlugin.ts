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

import * as fs from 'fs';

import { monotonicTime, spawnAsync } from 'playwright-core/lib/utils';

import type { TestRunnerPlugin } from './';
import type { FullConfig } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { GitCommitInfo, CIInfo, MetadataWithCommitInfo } from '../isomorphic/types';

const GIT_OPERATIONS_TIMEOUT_MS = 3000;

export const addGitCommitInfoPlugin = (fullConfig: FullConfigInternal) => {
  fullConfig.plugins.push({ factory: gitCommitInfoPlugin.bind(null, fullConfig) });
};

function print(s: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('GitCommitInfo: ' + s, ...args);
}

function debug(s: string, ...args: any[]) {
  if (!process.env.DEBUG_GIT_COMMIT_INFO)
    return;
  print(s, ...args);
}

const gitCommitInfoPlugin = (fullConfig: FullConfigInternal): TestRunnerPlugin => {
  return {
    name: 'playwright:git-commit-info',

    setup: async (config: FullConfig, configDir: string) => {
      const metadata = config.metadata as MetadataWithCommitInfo;
      const ci = await ciInfo();
      if (!metadata.ci && ci) {
        debug('ci info', ci);
        metadata.ci = ci;
      }

      if (fullConfig.captureGitInfo?.commit || (fullConfig.captureGitInfo?.commit === undefined && ci)) {
        const git = await gitCommitInfo(configDir).catch(e => print('failed to get git commit info', e));
        if (git) {
          debug('commit info', git);
          metadata.gitCommit = git;
        }
      }

      if (fullConfig.captureGitInfo?.diff || (fullConfig.captureGitInfo?.diff === undefined && ci)) {
        const diffResult = await gitDiff(configDir, ci).catch(e => print('failed to get git diff', e));
        if (diffResult) {
          debug(`diff length ${diffResult.length}`);
          metadata.gitDiff = diffResult;
        }
      }
    },
  };
};

async function ciInfo(): Promise<CIInfo | undefined> {
  if (process.env.GITHUB_ACTIONS) {
    let pr: { title: string, number: number, baseHash: string } | undefined;
    try {
      const json = JSON.parse(await fs.promises.readFile(process.env.GITHUB_EVENT_PATH!, 'utf8'));
      pr = { title: json.pull_request.title, number: json.pull_request.number, baseHash: json.pull_request.base.sha };
    } catch {
    }

    return {
      commitHref: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`,
      commitHash: process.env.GITHUB_SHA,
      prHref: pr ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/pull/${pr.number}` : undefined,
      prTitle: pr?.title,
      prBaseHash: pr?.baseHash,
      buildHref: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    };
  }

  if (process.env.GITLAB_CI) {
    return {
      commitHref: `${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`,
      commitHash: process.env.CI_COMMIT_SHA,
      buildHref: process.env.CI_JOB_URL,
      branch: process.env.CI_COMMIT_REF_NAME,
    };
  }

  if (process.env.JENKINS_URL && process.env.BUILD_URL) {
    return {
      commitHref: process.env.BUILD_URL,
      commitHash: process.env.GIT_COMMIT,
      branch: process.env.GIT_BRANCH,
    };
  }

  // Open to PRs.
}

async function gitCommitInfo(gitDir: string): Promise<GitCommitInfo | undefined> {
  const separator = `---786eec917292---`;
  const tokens = [
    '%H',  // commit hash
    '%h',  // abbreviated commit hash
    '%s',  // subject
    '%B',  // raw body (unwrapped subject and body)
    '%an', // author name
    '%ae', // author email
    '%at', // author date, UNIX timestamp
    '%cn', // committer name
    '%ce', // committer email
    '%ct', // committer date, UNIX timestamp
    '',    // branch
  ];
  const output = await runGit(`git log -1 --pretty=format:"${tokens.join(separator)}" && git rev-parse --abbrev-ref HEAD`, gitDir);
  if (!output)
    return undefined;
  const [hash, shortHash, subject, body, authorName, authorEmail, authorTime, committerName, committerEmail, committerTime, branch] = output.split(separator);

  return {
    shortHash,
    hash,
    subject,
    body,
    author: {
      name: authorName,
      email: authorEmail,
      time: +authorTime * 1000,
    },
    committer: {
      name: committerName,
      email: committerEmail,
      time: +committerTime * 1000,
    },
    branch: branch.trim(),
  };
}

async function gitDiff(gitDir: string, ci?: CIInfo): Promise<string | undefined> {
  const diffLimit = 100_000;
  if (ci?.prBaseHash) {
    // https://git-scm.com/docs/git-fetch
    await runGit(`git fetch origin ${ci.prBaseHash} --depth=1 --no-auto-maintenance --no-auto-gc --no-tags --no-recurse-submodules`, gitDir);
    const diff = await runGit(`git diff ${ci.prBaseHash} HEAD`, gitDir);
    if (diff)
      return diff.substring(0, diffLimit);
  }

  // Do not attempt to diff on CI commit.
  if (ci)
    return;

  // Check dirty state first.
  const uncommitted = await runGit('git diff', gitDir);
  if (uncommitted === undefined) {
    // Failed to run git diff.
    return;
  }
  if (uncommitted)
    return uncommitted.substring(0, diffLimit);

  // Assume non-shallow checkout on local.
  const diff = await runGit('git diff HEAD~1', gitDir);
  return diff?.substring(0, diffLimit);
}

async function runGit(command: string, cwd: string): Promise<string | undefined> {
  debug(`running "${command}"`);
  const start = monotonicTime();
  const result = await spawnAsync(
      command,
      [],
      { stdio: 'pipe', cwd, timeout: GIT_OPERATIONS_TIMEOUT_MS, shell: true }
  );
  if (monotonicTime() - start > GIT_OPERATIONS_TIMEOUT_MS) {
    print(`timeout of ${GIT_OPERATIONS_TIMEOUT_MS}ms exceeded while running "${command}"`);
    return;
  }
  if (result.code)
    debug(`failure, code=${result.code}\n\n${result.stderr}`);
  else
    debug(`success`);
  return result.code ? undefined : result.stdout.trim();
}
