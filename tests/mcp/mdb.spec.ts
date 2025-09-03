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

import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { runMainBackend, runOnPauseBackendLoop } from '../../packages/playwright/lib/mcp/sdk/mdb';

import { test, expect } from './fixtures';

test('call top level tool', async () => {
  const { mdbUrl } = await startMDBAndCLI();
  const mdbClient = await createMDBClient(mdbUrl);

  const { tools } = await mdbClient.client.listTools();
  expect(tools).toEqual([{
    name: 'cli_echo',
    description: 'Echo a message',
    inputSchema: expect.any(Object),
  }, {
    name: 'cli_pause_in_gdb',
    description: 'Pause in gdb',
    inputSchema: expect.any(Object),
  }, {
    name: 'cli_pause_in_gdb_twice',
    description: 'Pause in gdb twice',
    inputSchema: expect.any(Object),
  }
  ]);

  const echoResult = await mdbClient.client.callTool({
    name: 'cli_echo',
    arguments: {
      message: 'Hello, world!',
    },
  });
  expect(echoResult.content).toEqual([{ type: 'text', text: 'Echo: Hello, world!' }]);

  await mdbClient.close();
});

test('pause on error', async () => {
  const { mdbUrl } = await startMDBAndCLI();
  const mdbClient = await createMDBClient(mdbUrl);

  // Make a call that results in a recoverable error.
  const interruptResult = await mdbClient.client.callTool({
    name: 'cli_pause_in_gdb',
    arguments: {},
  });
  expect(interruptResult.content).toEqual([{ type: 'text', text: 'Paused on exception' }]);

  // List new inner tools.
  const { tools } = await mdbClient.client.listTools();
  expect(tools).toEqual([
    expect.objectContaining({
      name: 'gdb_bt',
    }),
    expect.objectContaining({
      name: 'gdb_continue',
    }),
  ]);

  // Call the new inner tool.
  const btResult = await mdbClient.client.callTool({
    name: 'gdb_bt',
    arguments: {},
  });
  expect(btResult.content).toEqual([{ type: 'text', text: 'Backtrace' }]);

  // Continue execution.
  const continueResult = await mdbClient.client.callTool({
    name: 'gdb_continue',
    arguments: {},
  });
  expect(continueResult.content).toEqual([{ type: 'text', text: 'Done' }]);

  await mdbClient.close();
});

test('pause on error twice', async () => {
  const { mdbUrl } = await startMDBAndCLI();
  const mdbClient = await createMDBClient(mdbUrl);

  // Make a call that results in a recoverable error.
  const result = await mdbClient.client.callTool({
    name: 'cli_pause_in_gdb_twice',
    arguments: {},
  });
  expect(result.content).toEqual([{ type: 'text', text: 'Paused on exception 1' }]);

  // Continue execution.
  const continueResult1 = await mdbClient.client.callTool({
    name: 'gdb_continue',
    arguments: {},
  });
  expect(continueResult1.content).toEqual([{ type: 'text', text: 'Paused on exception 2' }]);

  const continueResult2 = await mdbClient.client.callTool({
    name: 'gdb_continue',
    arguments: {},
  });
  expect(continueResult2.content).toEqual([{ type: 'text', text: 'Done' }]);

  await mdbClient.close();
});

async function startMDBAndCLI(): Promise<{ mdbUrl: string }> {
  const mdbUrlBox = { mdbUrl: undefined as string | undefined };
  const cliBackendFactory = {
    name: 'CLI',
    nameInConfig: 'cli',
    version: '0.0.0',
    create: () => new CLIBackend(mdbUrlBox)
  };

  const mdbUrl = (await runMainBackend(cliBackendFactory, { port: 0 }))!;
  mdbUrlBox.mdbUrl = mdbUrl;
  return { mdbUrl };
}

async function createMDBClient(mdbUrl: string): Promise<{ client: Client, close: () => Promise<void> }> {
  const client = new Client({ name: 'Internal client', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mdbUrl));
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await transport.terminateSession();
      await client.close();
    }
  };
}

class CLIBackend {
  constructor(private readonly mdbUrlBox: { mdbUrl: string | undefined }) {}

  async listTools() {
    return [{
      name: 'cli_echo',
      description: 'Echo a message',
      inputSchema: zodToJsonSchema(z.object({ message: z.string() })) as any,
    }, {
      name: 'cli_pause_in_gdb',
      description: 'Pause in gdb',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }, {
      name: 'cli_pause_in_gdb_twice',
      description: 'Pause in gdb twice',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }];
  }

  async callTool(name: string, args: any) {
    if (name === 'cli_echo')
      return { content: [{ type: 'text', text: 'Echo: ' + (args?.message as string) }] };
    if (name === 'cli_pause_in_gdb') {
      await runOnPauseBackendLoop(this.mdbUrlBox.mdbUrl!, new GDBBackend(), 'Paused on exception');
      return { content: [{ type: 'text', text: 'Done' }] };
    }
    if (name === 'cli_pause_in_gdb_twice') {
      await runOnPauseBackendLoop(this.mdbUrlBox.mdbUrl!, new GDBBackend(), 'Paused on exception 1');
      await runOnPauseBackendLoop(this.mdbUrlBox.mdbUrl!, new GDBBackend(), 'Paused on exception 2');
      return { content: [{ type: 'text', text: 'Done' }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}

class GDBBackend {
  async listTools() {
    return [{
      name: 'gdb_bt',
      description: 'Print backtrace',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }, {
      name: 'gdb_continue',
      description: 'Continue execution',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }];
  }

  async callTool(name: string) {
    if (name === 'gdb_bt')
      return { content: [{ type: 'text', text: 'Backtrace' }] };
    if (name === 'gdb_continue') {
      (this as any).requestSelfDestruct?.();
      // Stall
      await new Promise(f => setTimeout(f, 1000));
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}
