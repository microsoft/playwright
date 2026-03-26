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

import { loadConfigFromFile } from './common/configLoader';
import { ClaudeGenerator, OpencodeGenerator, VSCodeGenerator, CopilotGenerator } from './agents/generateAgents';

export async function initAgents(opts: { [key: string]: any }) {
  const config = await loadConfigFromFile(opts.config);
  if (opts.loop === 'opencode') {
    await OpencodeGenerator.init(config, opts.project, opts.prompts);
  } else if (opts.loop === 'vscode-legacy') {
    await VSCodeGenerator.init(config, opts.project);
  } else if (opts.loop === 'claude') {
    await ClaudeGenerator.init(config, opts.project, opts.prompts);
  } else {
    await CopilotGenerator.init(config, opts.project, opts.prompts);
    return;
  }
}
