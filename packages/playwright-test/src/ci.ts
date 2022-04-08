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
import { createGuid } from 'playwright-core/lib/utils';
import { spawnAsync } from 'playwright-core/lib/utils/spawnAsync';

const GIT_OPERATIONS_TIMEOUT_MS = 1500;
const kContentTypePlainText = 'text/plain';
const kContentTypeJSON = 'application/json';
export interface Attachment {
    name: string;
    contentType: string;
    path?: string;
    body?: Buffer;
}

export const gitStatusFromCLI = async (gitDir: string): Promise<Attachment[]> => {
  const separator = `:${createGuid().slice(0, 4)}:`;
  const { code, stdout } = await spawnAsync(
      'git',
      ['show', '-s', `--format=%H${separator}%s${separator}%an${separator}%ae${separator}%ct`, 'HEAD'],
      { stdio: 'pipe', cwd: gitDir, timeout: GIT_OPERATIONS_TIMEOUT_MS }
  );
  if (code)
    return [];
  const showOutput = stdout.trim();
  const [sha, subject, authorName, authorEmail, rawTimestamp] = showOutput.split(separator);
  let timestamp: number = Number.parseInt(rawTimestamp, 10);
  timestamp = Number.isInteger(timestamp) ? timestamp * 1000 : 0;

  return [
    { name: 'revision.id', body: Buffer.from(sha), contentType: kContentTypePlainText },
    { name: 'revision.author', body: Buffer.from(authorName), contentType: kContentTypePlainText },
    { name: 'revision.email', body: Buffer.from(authorEmail), contentType: kContentTypePlainText },
    { name: 'revision.subject', body: Buffer.from(subject), contentType: kContentTypePlainText },
    { name: 'revision.timestamp', body: Buffer.from(JSON.stringify(timestamp)),  contentType: kContentTypeJSON },
  ];
};

export const githubEnv = async (): Promise<Attachment[]> => {
  const out: Attachment[] = [];
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA)
    out.push({ name: 'revision.link', body: Buffer.from(`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`), contentType: kContentTypePlainText });

  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID)
    out.push({ name: 'ci.link', body: Buffer.from(`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`), contentType: kContentTypePlainText });

  return out;
};

export const gitlabEnv = async (): Promise<Attachment[]> => {
  // GitLab: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  const out: Attachment[] = [];
  if (process.env.CI_PROJECT_URL && process.env.CI_COMMIT_SHA)
    out.push({ name: 'revision.link', body: Buffer.from(`${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`), contentType: kContentTypePlainText });

  if (process.env.CI_JOB_URL)
    out.push({ name: 'ci.link', body: Buffer.from(process.env.CI_JOB_URL), contentType: kContentTypePlainText });

  return out;
};

export const jenkinsEnv = async (): Promise<Attachment[]> => {
  // Jenkins: https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#using-environment-variables
  const out: Attachment[] = [];
  if (process.env.BUILD_URL)
    out.push({ name: 'ci.link', body: Buffer.from(process.env.BUILD_URL), contentType: kContentTypePlainText });

  return out;
};

export const generationTimestamp = async (): Promise<Attachment[]> => {
  return [{ name: 'generatedAt', body: Buffer.from(JSON.stringify(Date.now())), contentType: kContentTypeJSON }];
};
