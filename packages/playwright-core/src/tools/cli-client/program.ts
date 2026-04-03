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

/* eslint-disable no-console */
/* eslint-disable no-restricted-properties */

import { execSync, spawn } from 'child_process';

import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { clientKey, createClientInfo, explicitSessionName, Registry, resolveSessionName } from './registry';
import { Session, renderResolvedConfig } from './session';
import { serverRegistry } from '../../serverRegistry';
import { minimist } from './minimist';

import type { ClientInfo, SessionFile } from './registry';
import type { BrowserStatus } from '../../serverRegistry';
import type { MinimistArgs } from './minimist';

type GlobalOptions = {
  help?: boolean;
  raw?: boolean;
  session?: string;
  version?: boolean;
};

type AttachOptions = {
  config?: string;
  cdp?: string;
  endpoint?: string;
  extension?: boolean | string;
};

type OpenOptions = {
  browser?: string;
  config?: string;
  headed?: boolean;
  persistent?: boolean;
  profile?: string;
};

const globalOptions: (keyof (GlobalOptions & OpenOptions & AttachOptions))[] = [
  'cdp',
  'endpoint',
  'browser',
  'config',
  'extension',
  'headed',
  'help',
  'persistent',
  'profile',
  'raw',
  'session',
  'version',
];

const booleanOptions: (keyof (GlobalOptions & OpenOptions & AttachOptions & { all?: boolean }))[] = [
  'all',
  'help',
  'raw',
  'version',
];

export async function program(options?: { embedderVersion?: string}) {
  const clientInfo = createClientInfo();
  const help = require('./help.json');

  const argv = process.argv.slice(2);
  const boolean = [...help.booleanOptions, ...booleanOptions];
  const args: MinimistArgs = minimist(argv, { boolean, string: ['_'] });
  // Normalize -s alias to --session
  if (args.s) {
    args.session = args.s;
    delete args.s;
  }

  const commandName = args._?.[0];

  if (args.version || args.v) {
    console.log(options?.embedderVersion ?? clientInfo.version);
    process.exit(0);
  }

  const command = commandName && help.commands[commandName];
  if (args.help || args.h) {
    if (command) {
      console.log(command.help);
    } else {
      console.log('playwright-cli - run playwright mcp commands from terminal\n');
      console.log(help.global);
    }
    process.exit(0);
  }

  if (!command) {
    console.error(`Unknown command: ${commandName}\n`);
    console.log(help.global);
    process.exit(1);
  }

  validateFlags(args, command);

  const registry = await Registry.load();
  const sessionName = resolveSessionName(args.session as string);

  switch (commandName) {
    case 'list': {
      await listSessions(registry, clientInfo, !!args.all);
      return;
    }
    case 'close-all': {
      const entries = registry.entries(clientInfo);
      for (const entry of entries)
        await new Session(entry).stop(true);
      return;
    }
    case 'delete-data': {
      const entry = registry.entry(clientInfo, sessionName);
      if (!entry) {
        console.log(`No user data found for browser '${sessionName}'.`);
        return;
      }
      await new Session(entry).deleteData();
      return;
    }
    case 'kill-all': {
      await killAllDaemons();
      return;
    }
    case 'open': {
      await startSession(sessionName, registry, clientInfo, args);
      return;
    }
    case 'attach': {
      const attachTarget = args._[1] as string | undefined;
      if (attachTarget && (args.cdp || args.endpoint || args.extension)) {
        console.error(`Error: cannot use target name with --cdp, --endpoint, or --extension`);
        process.exit(1);
      }
      if (attachTarget)
        args.endpoint = attachTarget;
      if (typeof args.extension === 'string') {
        args.browser = args.extension;
        args.extension = true;
      }
      const attachSessionName = explicitSessionName(args.session as string) ?? attachTarget ?? sessionName;
      args.session = attachSessionName;
      await startSession(attachSessionName, registry, clientInfo, args);
      return;
    }
    case 'close':
      const closeEntry = registry.entry(clientInfo, sessionName);
      const session = closeEntry ? new Session(closeEntry) : undefined;
      if (!session || !await session.canConnect()) {
        console.log(`Browser '${sessionName}' is not open.`);
        return;
      }
      await session.stop();
      return;
    case 'install':
      await runInitWorkspace(args);
      return;
    case 'install-browser':
      await installBrowser();
      return;
    case 'show': {
      const daemonScript = require.resolve('../dashboard/dashboardApp.js');
      const child = spawn(process.execPath, [daemonScript], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return;
    }
    default: {
      const entry = registry.entry(clientInfo, sessionName);
      if (!entry) {
        console.log(`The browser '${sessionName}' is not open, please run open first`);
        console.log('');
        console.log(`  playwright-cli${sessionName !== 'default' ? ` -s=${sessionName}` : ''} open [params]`);
        process.exit(1);
      }
      await runInSession(entry, clientInfo, args);
    }
  }
}

async function startSession(sessionName: string, registry: Registry, clientInfo: ClientInfo, args: MinimistArgs) {
  const entry = registry.entry(clientInfo, sessionName);
  if (entry)
    await new Session(entry).stop(true);

  await Session.startDaemon(clientInfo, args);
  const newEntry = await registry.loadEntry(clientInfo, sessionName);
  await runInSession(newEntry, clientInfo, args);
}

async function runInSession(entry: SessionFile, clientInfo: ClientInfo, args: MinimistArgs) {
  const raw = !!args.raw;
  for (const globalOption of globalOptions)
    delete args[globalOption];
  const session = new Session(entry);
  const result = await session.run(clientInfo, args, { raw });
  console.log(result.text);
}

async function runInitWorkspace(args: MinimistArgs) {
  const cliPath = require.resolve('../cli-daemon/program.js');
  const daemonArgs: string[] = [cliPath, '--init-workspace', ...(args.skills ? ['--init-skills', String(args.skills)] : [])];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, daemonArgs, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    child.on('close', code => {
      if (code === 0)
        resolve();
      else
        reject(new Error(`Workspace initialization failed with exit code ${code}`));
    });
  });
}

async function installBrowser() {
  const { program } = require('../../cli/program');
  const argv = process.argv.map(arg => arg === 'install-browser' ? 'install' : arg);
  program.parse(argv);
}

async function killAllDaemons(): Promise<void> {
  const platform = os.platform();
  let killed = 0;

  try {
    if (platform === 'win32') {
      const result = execSync(
          `powershell -NoProfile -NonInteractive -Command `
          + `"Get-CimInstance Win32_Process `
          + `| Where-Object { $_.CommandLine -like '*run-mcp-server*' -or $_.CommandLine -like '*run-cli-server*' -or $_.CommandLine -like '*cli-daemon*' -or $_.CommandLine -like '*dashboardApp.js*' } `
          + `| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }"`,
          { encoding: 'utf-8' }
      );
      const pids = result.split('\n')
          .map(line => line.trim())
          .filter(line => /^\d+$/.test(line));
      for (const pid of pids)
        console.log(`Killed daemon process ${pid}`);
      killed = pids.length;
    } else {
      const result = execSync('ps aux', { encoding: 'utf-8' });
      const lines = result.split('\n');
      for (const line of lines) {
        if (line.includes('run-mcp-server') || line.includes('run-cli-server') || line.includes('cli-daemon') || line.includes('dashboardApp.js')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && /^\d+$/.test(pid)) {
            try {
              process.kill(parseInt(pid, 10), 'SIGKILL');
              console.log(`Killed daemon process ${pid}`);
              killed++;
            } catch {
              // Process may have already exited
            }
          }
        }
      }
    }
  } catch (e) {
    // Silently handle errors - no processes to kill is fine
  }

  if (killed === 0)
    console.log('No daemon processes found.');
  else if (killed > 0)
    console.log(`Killed ${killed} daemon process${killed === 1 ? '' : 'es'}.`);
}

async function listSessions(registry: Registry, clientInfo: ClientInfo, all: boolean): Promise<void> {
  console.log('### Browsers');

  let count = 0;
  const runningSessions = new Set<string>();
  const entries = registry.entryMap();
  const key = clientKey(clientInfo);
  for (const [workspaceKey, list] of entries) {
    if (!all && workspaceKey !== key)
      continue;
    count += await gcAndPrintSessions(clientInfo, list.map(entry => new Session(entry)), all ? `${path.relative(process.cwd(), workspaceKey) || '/'}:` : undefined, runningSessions);
  }

  // Filter out server entries that already have an attached session.
  const serverEntries = await serverRegistry.list();
  const filteredServerEntries = new Map<string, BrowserStatus[]>();
  for (const [workspaceKey, list] of serverEntries) {
    if (!all && workspaceKey !== key)
      continue;
    const unattached = list.filter(d => !runningSessions.has(d.title));
    if (unattached.length)
      filteredServerEntries.set(workspaceKey, unattached);
  }

  if (filteredServerEntries.size) {
    if (count)
      console.log('');
    console.log('### Browser servers available for attach');
  }
  for (const [workspaceKey, list] of filteredServerEntries)
    count += await gcAndPrintBrowserSessions(workspaceKey, list);

  if (!count)
    console.log('  (no browsers)');
}

async function gcAndPrintSessions(clientInfo: ClientInfo, sessions: Session[], header?: string, runningSessions?: Set<string>) {
  const running: Session[] = [];
  const stopped: Session[] = [];

  for (const session of sessions) {
    const canConnect = await session.canConnect();
    if (canConnect) {
      running.push(session);
      runningSessions?.add(session.name);
    } else {
      if (session.config.cli.persistent)
        stopped.push(session);
      else
        await session.deleteSessionConfig();
    }
  }

  if (header && (running.length || stopped.length))
    console.log(header);

  for (const session of running)
    console.log(await renderSessionStatus(clientInfo, session));
  for (const session of stopped)
    console.log(await renderSessionStatus(clientInfo, session));

  return running.length + stopped.length;
}

async function gcAndPrintBrowserSessions(workspace: string, list: BrowserStatus[]): Promise<number> {
  if (!list.length)
    return 0;

  if (workspace)
    console.log(`${path.relative(process.cwd(), workspace) || '/'}:`);

  for (const descriptor of list) {
    const text: string[] = [];
    text.push(`- browser "${descriptor.title}":`);
    text.push(`  - browser: ${descriptor.browser.browserName}`);
    text.push(`  - version: v${descriptor.playwrightVersion}`);
    text.push(`  - status: ${descriptor.canConnect ? 'open' : 'closed'}`);
    if (descriptor.browser.userDataDir)
      text.push(`  - data-dir: ${descriptor.browser.userDataDir}`);
    else
      text.push(`  - data-dir: <in-memory>`);
    text.push(`  - run \`playwright-cli attach "${descriptor.title}"\` to attach`);
    console.log(text.join('\n'));
  }
  return list.length;
}

async function renderSessionStatus(clientInfo: ClientInfo, session: Session) {
  const text: string[] = [];
  const config = session.config;
  const canConnect = await session.canConnect();
  text.push(`- ${session.name}:`);
  text.push(`  - status: ${canConnect ? 'open' : 'closed'}`);
  if (canConnect && !session.isCompatible(clientInfo))
    text.push(`  - version: v${config.version} [incompatible please re-open]`);
  if (config.browser)
    text.push(...renderResolvedConfig(config));
  return text.join('\n');
}

function validateFlags(args: MinimistArgs, command: { flags: Record<string, 'boolean' | 'string'>, help: string }) {
  const unknownFlags: string[] = [];
  for (const key of Object.keys(args)) {
    if (key === '_')
      continue;
    if ((globalOptions as readonly string[]).includes(key))
      continue;
    if (!(key in command.flags))
      unknownFlags.push(key);
  }
  if (unknownFlags.length) {
    console.error(`Unknown option${unknownFlags.length > 1 ? 's' : ''}: ${unknownFlags.map(f => `--${f}`).join(', ')}`);
    console.log('');
    console.log(command.help);
    process.exit(1);
  }
}

export function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}
