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

import { tools } from './tools';
import { runTasks } from '../loop';

import type { Tool } from './tool';

export class Context {
  readonly tools = tools;
  private _codeCollector: string[] = [];

  constructor() {
  }

  async runTool(tool: Tool<any>, params: Record<string, unknown>): Promise<{ content: string }> {
    const { content, code } = await tool.handle(this, params);
    this._codeCollector.push(...code);
    return { content };
  }

  async generateCode(content: string) {
    await runTasks(this, ['Generate code for the following test spec: ' + content]);
    return this._codeCollector.join('\n');
  }
}
