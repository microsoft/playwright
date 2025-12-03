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

import { Loop } from 'playwright-core/lib/mcpBundle';

import type z from 'zod';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type * as lowireLoop from '@lowire/loop';

type Logger = (category: string, text: string, details?: string) => void;

export type AgentSpec = {
  name: string;
  description: string;
  model: string;
  color: string;
  tools: string[];
  instructions: string;
  examples: string[];
};

export class Agent<T extends z.ZodSchema<any>> {
  readonly loop: lowireLoop.Loop;
  readonly spec: AgentSpec;
  readonly clients: Map<string, Client>;
  readonly resultSchema: Tool['inputSchema'];

  constructor(loopName: 'github' | 'anthropic' | 'openai' | 'google', spec: AgentSpec, clients: Map<string, Client>, resultSchema: Tool['inputSchema']) {
    this.loop = new Loop(loopName, { model: spec.model });
    this.spec = spec;
    this.clients = clients;
    this.resultSchema = resultSchema;
  }

  async runTask(task: string, params: any, options?: { logger?: Logger }): Promise<z.output<T>> {
    const { clients, tools, callTool } = await this._initClients();
    const prompt = this.spec.description;
    try {
      return await this.loop.run<z.output<T>>(`${prompt}\n\nTask:\n${task}\n\nParams:\n${JSON.stringify(params, null, 2)}`, {
        ...options,
        tools,
        callTool,
        resultSchema: this.resultSchema
      });
    } finally {
      await this._disconnectFromServers(clients);
    }
  }

  private async _initClients() {
    const clients: Record<string, Client> = {};
    const agentToolNames = new Set<string>(this.spec.tools);
    const tools: Tool[] = [];

    for (const [name, client] of this.clients.entries()) {
      const list = await client.listTools();
      for (const tool of list.tools) {
        if (!agentToolNames.has(name + '/' + tool.name))
          continue;
        agentToolNames.delete(name + '/' + tool.name);
        tools.push({ ...tool, name: name + '__' + tool.name });
      }
      clients[name] = client;
    }

    if (agentToolNames.size > 0)
      throw new Error(`Required tools not found: ${Array.from(agentToolNames).join(', ')}`);

    const callTool: (params: { name: string, arguments: any}) => Promise<lowireLoop.ToolResult> = async params => {
      const [serverName, toolName] = params.name.split('__');
      const client = clients[serverName];
      if (!client)
        throw new Error(`Unknown server: ${serverName}`);
      return await client.callTool({ name: toolName, arguments: params.arguments }) as lowireLoop.ToolResult;
    };
    return { clients, tools, callTool };
  }

  private async _disconnectFromServers(clients: Record<string, Client>) {
    for (const client of Object.values(clients))
      await client.close();
  }
}
