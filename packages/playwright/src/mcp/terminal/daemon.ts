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

import fs from 'fs/promises';
import net from 'net';
import os from 'os';
import path from 'path';
import url from 'url';

import { debug } from 'playwright-core/lib/utilsBundle';
import { SocketConnection } from './socketConnection';
import { browserTools } from '../browser/tools';
import { aliases } from './commands';

import type { ServerBackendFactory } from '../sdk/server';
import type * as mcp from '../sdk/exports';
import type { z } from 'zod';

const daemonDebug = debug('pw:daemon');

async function socketExists(socketPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(socketPath);
    if (stat?.isSocket())
      return true;
  } catch (e) {
  }
  return false;
}

/**
 * Start a daemon server listening on Unix domain socket (Unix) or named pipe (Windows).
 */
export async function startMcpDaemonServer(
  socketPath: string,
  serverBackendFactory: ServerBackendFactory
): Promise<string> {
  // Clean up existing socket file on Unix
  if (os.platform() !== 'win32' && await socketExists(socketPath)) {
    daemonDebug(`Socket already exists, removing: ${socketPath}`);
    try {
      await fs.unlink(socketPath);
    } catch (error) {
      daemonDebug(`Failed to remove existing socket: ${error}`);
      throw error;
    }
  }

  const backend = serverBackendFactory.create();
  const cwd = url.pathToFileURL(process.cwd()).href;
  await backend.initialize?.({
    name: 'playwright-cli',
    version: '1.0.0',
    roots: [{
      uri: cwd,
      name: 'cwd'
    }],
    timestamp: Date.now(),
  });

  await fs.mkdir(path.dirname(socketPath), { recursive: true });

  const server = net.createServer(socket => {
    daemonDebug('new client connection');
    const connection = new SocketConnection(socket);
    connection.onclose = () => {
      daemonDebug('client disconnected');
    };
    connection.onmessage = async message => {
      const { id, method, params } = message;
      try {
        daemonDebug('received command', method);
        if (method === 'runCliCommand') {
          const { toolName, args } = parseCliCommand(params.argv);
          const adjustedArgs = adjustCommandParameters(toolName, args);
          const response = await backend.callTool(toolName, adjustedArgs, () => {});
          await connection.send({ id, result: formatResult(response) });
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (e) {
        daemonDebug('command failed', e);
        await connection.send({ id, error: (e as Error).message });
      }
    };
  });

  return new Promise((resolve, reject) => {
    server.on('error', (error: NodeJS.ErrnoException) => {
      daemonDebug(`server error: ${error.message}`);
      reject(error);
    });

    server.listen(socketPath, () => {
      daemonDebug(`daemon server listening on ${socketPath}`);
      resolve(socketPath);
    });
  });
}

function formatResult(result: mcp.CallToolResult) {
  const lines = [];
  for (const content of result.content) {
    if (content.type === 'text')
      lines.push(content.text);
    else
      lines.push(`<${content.type} content>`);
  }
  return lines.join('\n');
}

function camelToKebabCase(camel: string): string {
  return camel.replace(/([A-Z])/g, letter => `-${letter.toLowerCase()}`);
}

function canonicalName(name: string): string {
  for (const [canonicalName, nameAliases] of Object.entries(aliases)) {
    if (nameAliases.includes(name))
      return canonicalName;
  }
  return name;
}

function parseCliCommand(argv: string[]): { toolName: string, args: mcp.CallToolRequest['params']['arguments'] } {
  const parsed = require('minimist')(argv);

  const commandAlias = parsed._[0];
  if (!commandAlias)
    throw new Error('Command is required');

  const toolName = `browser_${canonicalName(commandAlias)}`;
  const tool = browserTools.find(tool => tool.schema.name === toolName);
  if (!tool)
    throw new Error(`Unknown command: ${commandAlias}.`);

  const args: mcp.CallToolRequest['params']['arguments'] = {};

  const inputSchema = tool.schema.inputSchema.toJSONSchema() as z.core.JSONSchema.BaseSchema;

  const requiredProperties = (inputSchema.required || []).filter(p => {
    const property = inputSchema.properties?.[p];
    return !(typeof property === 'object' && 'default' in property);
  });

  const freeArguments = parsed._.slice(1);
  if (requiredProperties.length && freeArguments.length < requiredProperties.length)
    throw new Error(`Missing required parameter(s): ${requiredProperties.slice(freeArguments.length).map(r => `${r}`).join(', ')}`);

  let index = 0;
  for (const requiredProperty of requiredProperties)
    args[requiredProperty] = freeArguments[index++];

  Object.entries(inputSchema.properties || {}).forEach(([propertyName, schema]) => {
    const optionName = camelToKebabCase(propertyName);
    if (optionName in parsed)
      args[propertyName] = parsed[optionName];
    else if (typeof schema === 'object' && schema.default !== undefined)
      args[propertyName] = schema.default;
  });

  return { toolName, args };
}

function adjustCommandParameters(toolName: string, args: mcp.CallToolRequest['params']['arguments']): mcp.CallToolRequest['params']['arguments'] {
  if (toolName === 'browser_snapshot') {
    args ??= {};
    if (!('filename' in args)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      args.filename = `snapshot-${timestamp}.md`;
    }
  }
  return args;
}
