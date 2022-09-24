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
import type { FullConfig, Reporter, Suite } from '../../types/testReporter';
import { colors } from 'playwright-core/lib/utilsBundle';
import { checkDockerEngineIsRunningOrDie, containerInfo, ensurePlaywrightContainerOrDie } from 'playwright-core/lib/containers/docker';

export const dockerPlugin: TestRunnerPlugin = {
  name: 'playwright:docker',

  async setup(config: FullConfig, configDir: string, rootSuite: Suite, reporter: Reporter) {
    if (!process.env.PLAYWRIGHT_DOCKER)
      return;

    const print = (text: string) => reporter.onStdOut?.(text);
    const println = (text: string) => reporter.onStdOut?.(text + '\n');

    println(colors.dim('Using docker container to run browsers.'));
    await checkDockerEngineIsRunningOrDie();
    let info = await containerInfo();
    if (!info) {
      print(colors.dim(`Starting docker container... `));
      const time = Date.now();
      info = await ensurePlaywrightContainerOrDie();
      const deltaMs = (Date.now() - time);
      println(colors.dim('Done in ' + (deltaMs / 1000).toFixed(1) + 's'));
      println(colors.dim('The Docker container will keep running after tests finished.'));
      println(colors.dim('Stop manually using:'));
      println(colors.dim('    npx playwright docker stop'));
    }
    println(colors.dim(`View screen: ${info.vncSession}`));
    println('');
    process.env.PW_TEST_CONNECT_WS_ENDPOINT = info.wsEndpoint;
    process.env.PW_TEST_CONNECT_HEADERS = JSON.stringify({
      'x-playwright-proxy': '*',
    });
  },
};


