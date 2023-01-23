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

import type { TestRunnerPlugin } from '.';
import type { FullConfig, Reporter } from '../../types/testReporter';
import { colors } from 'playwright-core/lib/utilsBundle';
import { checkDockerEngineIsRunningOrDie, containerInfo } from 'playwright-core/lib/containers/docker';

export const dockerPlugin: TestRunnerPlugin = {
  name: 'playwright:docker',

  async setup(config: FullConfig, configDir: string, reporter: Reporter) {
    if (!process.env.PLAYWRIGHT_DOCKER)
      return;

    const println = (text: string) => reporter.onStdOut?.(text + '\n');

    println(colors.dim('Using docker container to run browsers.'));
    await checkDockerEngineIsRunningOrDie();
    const info = await containerInfo();
    if (!info)
      throw new Error('ERROR: please launch docker container separately!');
    println('');
    process.env.PW_TEST_CONNECT_WS_ENDPOINT = info.httpEndpoint;
    process.env.PW_TEST_CONNECT_EXPOSE_NETWORK = '*';
  },
};


