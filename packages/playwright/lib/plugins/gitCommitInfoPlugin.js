"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.gitStatusFromCLI = exports.gitCommitInfo = void 0;
var _utils = require("playwright-core/lib/utils");
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

const GIT_OPERATIONS_TIMEOUT_MS = 1500;
const gitCommitInfo = options => {
  return {
    name: 'playwright:git-commit-info',
    setup: async (config, configDir) => {
      const info = {
        ...linksFromEnv(),
        ...(options !== null && options !== void 0 && options.info ? options.info : await gitStatusFromCLI((options === null || options === void 0 ? void 0 : options.directory) || configDir)),
        timestamp: Date.now()
      };
      // Normalize dates
      const timestamp = info['revision.timestamp'];
      if (timestamp instanceof Date) info['revision.timestamp'] = timestamp.getTime();
      config.metadata = config.metadata || {};
      Object.assign(config.metadata, info);
    }
  };
};
exports.gitCommitInfo = gitCommitInfo;
const linksFromEnv = () => {
  const out = {};
  // Jenkins: https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#using-environment-variables
  if (process.env.BUILD_URL) out['ci.link'] = process.env.BUILD_URL;
  // GitLab: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  if (process.env.CI_PROJECT_URL && process.env.CI_COMMIT_SHA) out['revision.link'] = `${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`;
  if (process.env.CI_JOB_URL) out['ci.link'] = process.env.CI_JOB_URL;
  // GitHub: https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA) out['revision.link'] = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`;
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) out['ci.link'] = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  return out;
};
const gitStatusFromCLI = async gitDir => {
  const separator = `:${(0, _utils.createGuid)().slice(0, 4)}:`;
  const {
    code,
    stdout
  } = await (0, _utils.spawnAsync)('git', ['show', '-s', `--format=%H${separator}%s${separator}%an${separator}%ae${separator}%ct`, 'HEAD'], {
    stdio: 'pipe',
    cwd: gitDir,
    timeout: GIT_OPERATIONS_TIMEOUT_MS
  });
  if (code) return;
  const showOutput = stdout.trim();
  const [id, subject, author, email, rawTimestamp] = showOutput.split(separator);
  let timestamp = Number.parseInt(rawTimestamp, 10);
  timestamp = Number.isInteger(timestamp) ? timestamp * 1000 : 0;
  return {
    'revision.id': id,
    'revision.author': author,
    'revision.email': email,
    'revision.subject': subject,
    'revision.timestamp': timestamp
  };
};
exports.gitStatusFromCLI = gitStatusFromCLI;