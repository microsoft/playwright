/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { GridAgentLaunchOptions, GridFactory } from './gridServer';
import https from 'https';
import debug from 'debug';

const repoName = process.env.GITHUB_AGENT_REPO;
if (!repoName)
  throw new Error('GITHUB_AGENT_REPO is not specified.');

const repoAccessToken = process.env.GITHUB_AGENT_REPO_ACCESS_TOKEN;
if (!repoAccessToken)
  throw new Error('GITHUB_AGENT_REPO_ACCESS_TOKEN is not specified.');

const log = debug(`pw:grid:server`);

const githubFactory: GridFactory = {
  name: 'Agents hosted on Github',
  capacity: 10,
  launchTimeout: 10000,
  retireTimeout: 10000,
  launch: async (options: GridAgentLaunchOptions) => {
    await createWorkflow(options);
  },
};

async function createWorkflow(inputs: { gridURL: string, agentId: string, playwrightVersion: string }): Promise<boolean> {
  inputs.playwrightVersion = '1.20';
  return new Promise((fulfill, reject) => {
    log(`triggering workflow ${JSON.stringify(inputs)}`);
    const req = https.request(`https://api.github.com/repos/${repoName}/actions/workflows/agent.yml/dispatches`, {
      method: 'POST',
      headers: {
        'User-Agent': 'request',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${repoAccessToken}`,
      }
    }, response => {
      log(`workflow ${inputs.agentId} response: ${response.statusCode} ${response.statusMessage}`);
      const success = ((response.statusCode || 500) / 100 | 0) === 2;
      fulfill(success);
    });
    req.on('error', e => {
      log(`failed to create workflow ${inputs.agentId}`);
      reject('Request failed.');
    });
    req.end(JSON.stringify({
      'ref': 'refs/heads/main',
      inputs
    }));
  });
}

export default githubFactory;
