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

import * as mcp from '../../packages/playwright/lib/mcp/sdk/exports';
import * as mcpBundle from '../../packages/playwright/lib/mcp/sdk/bundle';
import { test, expect } from './fixtures';

import type http from 'http';

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
    name: 'cli_restart',
    description: 'Restart the process',
    inputSchema: expect.any(Object),
  }, {
    name: 'gdb_bt',
    description: 'Print backtrace',
    inputSchema: expect.any(Object),
  }, {
    name: 'gdb_echo',
    description: 'Echo a message',
    inputSchema: expect.any(Object),
  }]);

  const echoResult = await mdbClient.client.callTool({
    name: 'cli_echo',
    arguments: {
      message: 'Hello, world!',
    },
  });
  expect(echoResult.content).toEqual([{ type: 'text', text: 'Echo: Hello, world!, roots: ' }]);

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

  // Call the new inner tool.
  const btResult = await mdbClient.client.callTool({
    name: 'gdb_bt',
    arguments: {},
  });
  expect(btResult.content).toEqual([{ type: 'text', text: 'Backtrace' }]);

  await mdbClient.close();
});

test('outer and inner roots available', async () => {
  const { mdbUrl } = await startMDBAndCLI();
  const mdbClient = await createMDBClient(mdbUrl, [{ name: 'test', uri: 'file://tmp/' }]);

  expect(await mdbClient.client.callTool({
    name: 'cli_echo',
    arguments: {
      message: 'Hello, cli!',
    },
  })).toEqual({
    content: [{
      type: 'text',
      text: 'Echo: Hello, cli!, roots: test=file://tmp/',
    }]
  });

  await mdbClient.client.callTool({
    name: 'cli_pause_in_gdb',
    arguments: {},
  });

  expect(await mdbClient.client.callTool({
    name: 'gdb_echo',
    arguments: {
      message: 'Hello, bt!',
    },
  })).toEqual({
    content: [{
      type: 'text',
      text: 'Echo: Hello, bt!, roots: test=file://tmp/',
    }]
  });

  await mdbClient.close();
});

test('should reset', async () => {
  const { mdbUrl, log } = await startMDBAndCLI();
  const mdbClient = await createMDBClient(mdbUrl);

  // Make a call that results in a recoverable error.
  const interruptResult = await mdbClient.client.callTool({
    name: 'cli_pause_in_gdb',
    arguments: {},
  });
  expect(interruptResult.content).toEqual([{ type: 'text', text: 'Paused on exception' }]);

  // Call the new inner tool.
  const btResult = await mdbClient.client.callTool({
    name: 'gdb_bt',
    arguments: {},
  });
  expect(btResult.content).toEqual([{ type: 'text', text: 'Backtrace' }]);

  await mdbClient.client.callTool({
    name: 'cli_echo',
    arguments: {},
  });

  await expect.poll(() => log).toEqual([
    'CLI: initialize',
    'CLI: callTool cli_pause_in_gdb',
    'GDB: listTools',
    'GDB: initialize',
    'GDB: callTool gdb_bt',
    'CLI: afterCallTool gdb_bt',
    'GDB: serverClosed',
    'CLI: callTool cli_echo',
  ]);

  const restartResult = await mdbClient.client.callTool({
    name: 'cli_restart',
    arguments: {},
  });
  expect(restartResult.content).toEqual([{ type: 'text', text: 'Restarted' }]);

  const pauseResult = await mdbClient.client.callTool({
    name: 'cli_pause_in_gdb',
    arguments: {},
  });
  expect(pauseResult.content).toEqual([{ type: 'text', text: 'Paused on exception' }]);

  const btResult2 = await mdbClient.client.callTool({
    name: 'gdb_bt',
    arguments: {},
  });
  expect(btResult2.content).toEqual([{ type: 'text', text: 'Backtrace' }]);

  await expect.poll(() => log).toEqual([
    'CLI: initialize',
    'CLI: callTool cli_pause_in_gdb',
    'GDB: listTools',
    'GDB: initialize',
    'GDB: callTool gdb_bt',
    'CLI: afterCallTool gdb_bt',
    'GDB: serverClosed',
    'CLI: callTool cli_echo',
    'CLI: callTool cli_restart',
    'CLI: callTool cli_pause_in_gdb',
    'GDB: listTools',
    'GDB: initialize',
    'GDB: callTool gdb_bt',
    'CLI: afterCallTool gdb_bt',
  ]);

  await mdbClient.close();
});

test('mdb has unguessable url', async () => {
  let firstPathname: string | undefined;
  let secondPathname: string | undefined;
  {
    const { mdbUrl } = await startMDBAndCLI();
    firstPathname = new URL(mdbUrl).pathname;
    const mdbClient = await createMDBClient(mdbUrl);
    await mdbClient.close();
  }
  {
    const { mdbUrl } = await startMDBAndCLI();
    secondPathname = new URL(mdbUrl).pathname;
    const mdbClient = await createMDBClient(mdbUrl);
    await mdbClient.close();
  }
  expect(firstPathname.length).toBe(37);
  expect(secondPathname.length).toBe(37);
  expect(firstPathname).not.toBe(secondPathname);
});

async function startMDBAndCLI(): Promise<{ mdbUrl: string, log: string[] }> {
  const mdbUrlBox = { mdbUrl: undefined as string | undefined };
  const log: string[] = [];
  const cliBackendFactory = {
    name: 'CLI',
    nameInConfig: 'cli',
    version: '0.0.0',
    create: pushClient => new CLIBackend(log, pushClient)
  };

  const mdbUrl = (await mcp.runMainBackend(cliBackendFactory, { port: 0 }))!;
  mdbUrlBox.mdbUrl = mdbUrl;
  return { mdbUrl, log };
}

async function createMDBClient(mdbUrl: string, roots: any[] | undefined = undefined): Promise<{ client: Client, close: () => Promise<void> }> {
  const client = new Client({ name: 'Test client', version: '0.0.0' }, roots ? { capabilities: { roots: {} } } : undefined);
  if (roots)
    client.setRequestHandler(mcpBundle.ListRootsRequestSchema, () => ({ roots }));
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
  private _roots: any[] | undefined;
  private _log: string[] = [];
  private _pushClient: (url: string, message: string) => Promise<void>;
  private _gdbServer: http.Server | undefined;

  constructor(log: string[], pushClient: (url: string, message: string) => Promise<void>) {
    this._log = log;
    this._pushClient = pushClient;
  }

  async initialize(server, clientInfo) {
    this._log.push('CLI: initialize');
    this._roots = clientInfo.roots;
  }

  async listTools() {
    this._log.push('CLI: listTools');
    return [{
      name: 'cli_echo',
      description: 'Echo a message',
      inputSchema: zodToJsonSchema(z.object({ message: z.string() })) as any,
    }, {
      name: 'cli_pause_in_gdb',
      description: 'Pause in gdb',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }, {
      name: 'cli_restart',
      description: 'Restart the process',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }, {
      name: 'gdb_bt',
      description: 'Print backtrace',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }, {
      name: 'gdb_echo',
      description: 'Echo a message',
      inputSchema: zodToJsonSchema(z.object({ message: z.string() })) as any,
    }];
  }

  async afterCallTool(name: string, args: any) {
    this._log.push(`CLI: afterCallTool ${name}`);
  }

  async callTool(name: string, args: any) {
    this._log.push(`CLI: callTool ${name}`);
    if (name === 'cli_echo')
      return { content: [{ type: 'text', text: `Echo: ${args?.message as string}, roots: ${stringifyRoots(this._roots)}` }] };
    if (name === 'cli_pause_in_gdb') {
      const factory = {
        name: 'gdb',
        nameInConfig: 'gdb',
        version: '0.0.0',
        create: () => new GDBBackend(this._log),
      };
      this._gdbServer = await mcp.startHttpServer({ port: 0 });
      const mcpUrl = await mcp.installHttpTransport(this._gdbServer, factory, true);
      await this._pushClient(mcpUrl, 'Paused on exception');
      return { content: [{ type: 'text', text: 'Done' }] };
    }
    if (name === 'cli_restart') {
      this._gdbServer.close();
      this._gdbServer = undefined;
      return { content: [{ type: 'text', text: 'Restarted' }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  serverClosed() {
    this._log.push('CLI: serverClosed');
  }
}

class GDBBackend {
  private _roots: any[] | undefined;
  private _log: string[] = [];

  constructor(log: string[]) {
    this._log = log;
  }

  async initialize(server, clientVersion) {
    this._log.push('GDB: initialize');
    this._roots = clientVersion.roots;
  }

  async listTools() {
    this._log.push('GDB: listTools');
    return [{
      name: 'gdb_bt',
      description: 'Print backtrace',
      inputSchema: zodToJsonSchema(z.object({})) as any,
    }, {
      name: 'gdb_echo',
      description: 'Echo a message',
      inputSchema: zodToJsonSchema(z.object({ message: z.string() })) as any,
    }];
  }

  async callTool(name: string, args: any) {
    this._log.push(`GDB: callTool ${name}`);
    if (name === 'gdb_echo')
      return { content: [{ type: 'text', text: `Echo: ${args?.message as string}, roots: ${stringifyRoots(this._roots)}` }] };
    if (name === 'gdb_bt')
      return { content: [{ type: 'text', text: 'Backtrace' }] };
    throw new Error(`Unknown tool: ${name}`);
  }

  serverClosed() {
    this._log.push('GDB: serverClosed');
  }
}

function stringifyRoots(roots: any[]) {
  return roots.map(root => `${root.name}=${root.uri}`).join(',');
}
