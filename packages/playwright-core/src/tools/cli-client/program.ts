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
import { listChannelSessions, remoteDebuggingHint } from './channelSessions';
import { clientKey, createClientInfo, explicitSessionName, isCodingAgent, Registry, resolveSessionName } from './registry';
import { Session, renderResolvedConfig } from './session';
import { libPath } from '../../package';
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
  'raw',
  'session',
];

const booleanOptions: (keyof (GlobalOptions & OpenOptions & AttachOptions & { all?: boolean }))[] = [
  'all',
  'help',
  'raw',
  'version',
];

export async function program(options?: { embedderVersion?: string}) {
  const clientInfo = createClientInfo();
  const help = require(libPath('tools', 'cli-client', 'help.json'));

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
  if (args.help || args.h || !commandName) {
    if (command) {
      console.log(command.help);
    } else {
      console.log('playwright-cli - run playwright mcp commands from terminal\n');
      if (isCodingAgent())
        console.log(`Agent skill: ${path.relative(process.cwd(), libPath('tools', 'cli-client', 'skill', 'SKILL.md'))}\n`);
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
      await startSession(sessionName, registry, clientInfo, args, 'open');
      const newEntry = await registry.loadEntry(clientInfo, sessionName);
      const params = args._.slice(1);
      await runInSession(newEntry, clientInfo, { _: ['goto', ...(params.length ? params : ['about:blank'])] });
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
      await startSession(attachSessionName, registry, clientInfo, args, 'attach');
      const newEntry = await registry.loadEntry(clientInfo, attachSessionName);
      await runInSession(newEntry, clientInfo, { _: ['snapshot'], filename: '<auto>' });
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
      const daemonScript = libPath('entry', 'dashboardApp.js');
      const daemonArgs = [
        daemonScript,
        `--session=${sessionName}`,
        `--workspace=${clientInfo.workspaceDir ?? ''}`,
      ];
      if (args.port !== undefined)
        daemonArgs.push(`--port=${args.port}`);
      if (args.host !== undefined)
        daemonArgs.push(`--host=${args.host as string}`);
      const foreground = args.port !== undefined;
      const child = spawn(process.execPath, daemonArgs, {
        detached: !foreground,
        stdio: foreground ? 'inherit' : 'ignore',
      });
      if (foreground) {
        await new Promise<void>(resolve => child.on('exit', () => resolve()));
        return;
      }
      child.unref();
      if (process.env.PLAYWRIGHT_PRINT_DASHBOARD_PID_FOR_TEST)
        console.log(`### Dashboard opened with pid ${child.pid}.`);
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

async function startSession(sessionName: string, registry: Registry, clientInfo: ClientInfo, args: MinimistArgs, mode: 'open' | 'attach') {
  const entry = registry.entry(clientInfo, sessionName);
  if (entry)
    await new Session(entry).stop(true);
  await Session.startDaemon(clientInfo, args, mode);
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
  const cliPath = libPath('entry', 'cliDaemon.js');
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
  const argv = process.argv.map(arg => arg === 'install-browser' ? 'install' : arg);
  const { libCli } = require('../../coreBundle.js') as typeof import('../../coreBundle');
  const { program } = require('../../utilsBundle.js') as typeof import('../../utilsBundle');
  if (!program.version())
    libCli.decorateProgram(program);
  program.parse(argv);
}

const daemonProcessPatterns = ['run-mcp-server', 'run-cli-server', 'cli-daemon', 'cliDaemon.js', 'dashboardApp.js'];

async function killAllDaemons(): Promise<void> {
  const platform = os.platform();
  const pidFilterEnv = process.env.PLAYWRIGHT_KILL_ALL_PID_FILTER_FOR_TEST;
  const pidFilter = pidFilterEnv ? new Set(pidFilterEnv.split(',').map(p => parseInt(p, 10)).filter(n => !isNaN(n))) : undefined;
  let killed = 0;

  try {
    if (platform === 'win32') {
      const clauses = [`(${daemonProcessPatterns.map(p => `$_.CommandLine -like '*${p}*'`).join(' -or ')})`];
      if (pidFilter)
        clauses.push(`(${[...pidFilter].map(p => `$_.ProcessId -eq ${p}`).join(' -or ')})`);
      const whereClause = clauses.join(' -and ');
      const result = execSync(
          `powershell -NoProfile -NonInteractive -Command `
          + `"Get-CimInstance Win32_Process `
          + `| Where-Object { ${whereClause} } `
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
      const result = execSync('ps auxww', { encoding: 'utf-8' });
      const lines = result.split('\n');
      for (const line of lines) {
        if (daemonProcessPatterns.some(p => line.includes(p))) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && /^\d+$/.test(pid)) {
            const numericPid = parseInt(pid, 10);
            if (pidFilter && !pidFilter.has(numericPid))
              continue;
            try {
              process.kill(numericPid, 'SIGKILL');
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
  let count = 0;
  const runningSessions = new Set<string>();
  const entries = registry.entryMap();
  const key = clientKey(clientInfo);
  for (const [workspaceKey, list] of entries) {
    if (!all && workspaceKey !== key)
      continue;
    if (count === 0)
      console.log('### Browsers');
    count += await gcAndPrintSessions(clientInfo, list.map(entry => new Session(entry)), all ? `${path.relative(process.cwd(), workspaceKey) || '/'}:` : undefined, runningSessions);
  }

  // Filter out server entries that already have an attached session.
  const serverEntries = await serverRegistry.list();
  if (serverEntries.size) {
    if (count)
      console.log('');
    console.log('### Browser servers available for attach');
  }
  for (const [workspaceKey, list] of serverEntries)
    count += await gcAndPrintBrowserSessions(workspaceKey, list);

  if (!count)
    console.log('  (no browsers)');

  const channelSessions = await listChannelSessions();
  if (channelSessions.length) {
    console.log('');
    console.log('### Browsers available to attach via CDP');
    for (const session of channelSessions) {
      const text: string[] = [];
      text.push(`- ${session.channel}:`);
      text.push(`  - data-dir: ${session.userDataDir}`);
      if (session.endpoint) {
        text.push(`  - endpoint: ${session.endpoint}`);
        text.push(`  - run \`playwright-cli attach --cdp=${session.channel}\` to attach`);
      } else {
        text.push(`  - status: remote debugging not enabled`);
        text.push(`  - ${remoteDebuggingHint(session.channel)}`);
      }
      console.log(text.join('\n'));
    }
  }
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
