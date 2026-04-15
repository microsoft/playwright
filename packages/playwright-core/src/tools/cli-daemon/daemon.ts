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

import fs from 'fs';
import net from 'net';
import path from 'path';

import { decorateServer } from '@utils/network';
import { makeSocketPath } from '@utils/fileUtils';
import { gracefullyProcessExitDoNotHang } from '@utils/processLauncher';

import { BrowserBackend } from '../backend/browserBackend';
import { browserTools } from '../backend/tools';
import { parseCommand } from './command';
import { commands } from './commands';

import { SocketConnection } from '../utils/socketConnection';
import type * as playwright from '../../..';
import type { SessionConfig, ClientInfo } from '../cli-client/registry';
import type { CallToolRequest, CallToolResult } from '../backend/tool';
import type { ContextConfig } from '../backend/context';
import type { BrowserInfo } from '../../serverRegistry';
import type { ClientInfo as McpClientInfo } from '../utils/mcp/server';

async function socketExists(socketPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(socketPath);
    if (stat?.isSocket())
      return true;
  } catch (e) {
  }
  return false;
}

export async function startCliDaemonServer(
  sessionName: string,
  browserContext: playwright.BrowserContext,
  browserInfo: BrowserInfo,
  contextConfig: ContextConfig,
  clientInfo: ClientInfo,
  mcpClientInfo: McpClientInfo,
  options: {
    ownership?: 'attached' | 'own',
    persistent?: boolean,
    exitOnClose?: boolean,
  }
): Promise<string> {
  const sessionConfig = createSessionConfig(clientInfo, sessionName, browserInfo, options);
  const { socketPath } = sessionConfig;

  // Clean up existing socket file on Unix
  if (process.platform !== 'win32' && await socketExists(socketPath)) {
    try {
      await fs.promises.unlink(socketPath);
    } catch (error) {
      throw error;
    }
  }

  const backend = new BrowserBackend(contextConfig, browserContext, browserTools);
  await backend.initialize(mcpClientInfo);

  if (browserContext.isClosed())
    throw new Error('Browser context was closed before the daemon could start');

  const server = net.createServer(socket => {
    const connection = new SocketConnection(socket);
    connection.onmessage = async message => {
      const { id, method, params } = message;
      try {
        if (method === 'stop') {
          await deleteSessionFile(clientInfo, sessionConfig);
          const sendAck = async () => connection.send({ id, result: 'ok' }).catch(() => {});
          if (options?.exitOnClose)
            gracefullyProcessExitDoNotHang(0, () => sendAck());
          else
            await sendAck();
        } else if (method === 'run') {
          const { toolName, toolParams } = parseCliCommand(params.args);
          toolParams._meta = { cwd: params.cwd, raw: params.raw };
          const response = await backend.callTool(toolName, toolParams);
          await connection.send({ id, result: formatResult(response) });
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (e) {
        const error = process.env.PWDEBUGIMPL ? (e as Error).stack || (e as Error).message : (e as Error).message;
        connection.send({ id, error }).catch(() => {});
      }
    };
  });

  decorateServer(server);
  browserContext.on('close', () => Promise.resolve().then(async () => {
    await deleteSessionFile(clientInfo, sessionConfig);
    if (options?.exitOnClose)
      gracefullyProcessExitDoNotHang(0);
  }));

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(socketPath, () => resolve());
  });

  await saveSessionFile(clientInfo, sessionConfig);
  return socketPath;
}

async function saveSessionFile(clientInfo: ClientInfo, sessionConfig: SessionConfig) {
  await fs.promises.mkdir(clientInfo.daemonProfilesDir, { recursive: true });
  const sessionFile = path.join(clientInfo.daemonProfilesDir, `${sessionConfig.name}.session`);
  await fs.promises.writeFile(sessionFile, JSON.stringify(sessionConfig, null, 2));
}

async function deleteSessionFile(clientInfo: ClientInfo, sessionConfig: SessionConfig) {
  await fs.promises.unlink(sessionConfig.socketPath).catch(() => {});
  if (!sessionConfig.cli.persistent) {
    const sessionFile = path.join(clientInfo.daemonProfilesDir, `${sessionConfig.name}.session`);
    await fs.promises.rm(sessionFile).catch(() => {});
  }
}

function formatResult(result: CallToolResult) {
  const isError = result.isError;
  const text = result.content[0].type === 'text' ? result.content[0].text : undefined;
  return { isError, text };
}

function parseCliCommand(args: Record<string, string> & { _: string[] }): { toolName: string, toolParams: NonNullable<CallToolRequest['params']['arguments']> } {
  const command = commands[args._[0]];
  if (!command)
    throw new Error('Command is required');
  return parseCommand(command, args);
}

function daemonSocketPath(clientInfo: ClientInfo, sessionName: string): string {
  return makeSocketPath('cli', `${clientInfo.workspaceDirHash}-${sessionName}`);
}

function createSessionConfig(clientInfo: ClientInfo, sessionName: string, browserInfo: BrowserInfo, options: {
  ownership?: 'attached' | 'own',
  persistent?: boolean,
  exitOnStop?: boolean,
} = {}): SessionConfig {
  return {
    name: sessionName,
    version: clientInfo.version,
    timestamp: Date.now(),
    socketPath: daemonSocketPath(clientInfo, sessionName),
    workspaceDir: clientInfo.workspaceDir,
    attached: options.ownership === 'attached' ? true : undefined,
    cli: { persistent: options.persistent },
    browser: {
      guid: browserInfo.guid,
      browserName: browserInfo.browserName,
      launchOptions: browserInfo.launchOptions,
      userDataDir: browserInfo.userDataDir,
    },
  };
}
