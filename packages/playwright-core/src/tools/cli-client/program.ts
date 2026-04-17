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

/* eslint-disable no-restricted-properties */

import { execSync, spawn } from 'child_process';

import crypto from 'crypto';
import os from 'os';

import { listChannelSessions } from './channelSessions';
import { JsonOutput, TextOutput } from './output';
import { clientKey, createClientInfo, explicitSessionName, Registry, resolveSessionName } from './registry';
import { Session } from './session';
import { libPath } from '../../package';
import { serverRegistry } from '../../serverRegistry';
import { minimist } from './minimist';

import type { ListData, ListedBrowser, Output } from './output';
import type { ClientInfo, SessionFile } from './registry';
import type { MinimistArgs } from './minimist';

type GlobalOptions = {
  help?: boolean;
  json?: boolean;
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
  'json',
  'raw',
  'session',
];

const booleanOptions: (keyof (GlobalOptions & OpenOptions & AttachOptions & { all?: boolean }))[] = [
  'all',
  'help',
  'json',
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

  const output: Output = args.json ? new JsonOutput() : new TextOutput();
  const commandName = args._?.[0];

  if (args.version || args.v) {
    output.version(options?.embedderVersion ?? clientInfo.version);
    process.exit(0);
  }

  const command = commandName && help.commands[commandName];
  if (args.help || args.h) {
    output.help(command ? command.help : 'playwright-cli - run playwright mcp commands from terminal\n\n' + help.global);
    process.exit(0);
  }

  if (!command)
    output.errorUnknownCommand(commandName, help.global);

  validateFlags(args, command, output);

  const registry = await Registry.load();
  const sessionName = resolveSessionName(args.session as string);

  switch (commandName) {
    case 'list': {
      const data = await collectList(registry, clientInfo, !!args.all);
      output.list(data);
      return;
    }
    case 'close-all': {
      const entries = registry.entries(clientInfo);
      const closed: string[] = [];
      for (const entry of entries) {
        await new Session(entry).stop();
        closed.push(entry.config.name);
      }
      output.closeAll(closed);
      return;
    }
    case 'delete-data': {
      const entry = registry.entry(clientInfo, sessionName);
      if (!entry) {
        output.deleteData(sessionName, { existed: false, deletedUserDataDir: false });
        return;
      }
      const result = await new Session(entry).deleteData();
      output.deleteData(sessionName, result);
      return;
    }
    case 'kill-all': {
      const pids = await killAllDaemons();
      output.killAll(pids);
      return;
    }
    case 'open': {
      const { pid } = await startSession(sessionName, registry, clientInfo, args, 'open');
      const newEntry = await registry.loadEntry(clientInfo, sessionName);
      const params = args._.slice(1);
      const toolText = await runInSession(newEntry, clientInfo, { _: ['goto', ...(params.length ? params : ['about:blank'])] }, output);
      output.open(sessionName, pid, toolText);
      return;
    }
    case 'attach': {
      const attachTarget = args._[1] as string | undefined;
      if (attachTarget && (args.cdp || args.endpoint || args.extension))
        output.errorAttachConflict();
      if (attachTarget)
        args.endpoint = attachTarget;
      if (typeof args.extension === 'string') {
        args.browser = args.extension;
        args.extension = true;
      }
      const attachSessionName = explicitSessionName(args.session as string) ?? attachTarget ?? sessionName;
      args.session = attachSessionName;
      const { pid, endpoint } = await startSession(attachSessionName, registry, clientInfo, args, 'attach');
      const newEntry = await registry.loadEntry(clientInfo, attachSessionName);
      const toolText = await runInSession(newEntry, clientInfo, { _: ['snapshot'], filename: '<auto>' }, output);
      output.attach(attachSessionName, pid, endpoint, toolText);
      return;
    }
    case 'close': {
      const closeEntry = registry.entry(clientInfo, sessionName);
      const { wasOpen } = closeEntry ? await new Session(closeEntry).stop() : { wasOpen: false };
      output.close(sessionName, wasOpen);
      return;
    }
    case 'install':
      await runInitWorkspace(args, output);
      output.installed();
      return;
    case 'install-browser':
      await installBrowser();
      output.installed();
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
      output.show(sessionName, child.pid);
      return;
    }
    default: {
      const entry = registry.entry(clientInfo, sessionName);
      if (!entry)
        output.errorBrowserNotOpenForTool(sessionName);
      const text = await runInSession(entry, clientInfo, args, output);
      output.toolResult(text);
    }
  }
}

async function startSession(sessionName: string, registry: Registry, clientInfo: ClientInfo, args: MinimistArgs, mode: 'open' | 'attach') {
  const entry = registry.entry(clientInfo, sessionName);
  if (entry)
    await new Session(entry).stop();
  return await Session.startDaemon(clientInfo, args, mode);
}

async function runInSession(entry: SessionFile, clientInfo: ClientInfo, args: MinimistArgs, output: Output): Promise<string> {
  const raw = !!args.raw;
  for (const globalOption of globalOptions)
    delete args[globalOption];
  const session = new Session(entry);
  const result = await session.run(clientInfo, args, { raw, json: output.json });
  return result.text;
}

async function runInitWorkspace(args: MinimistArgs, output: Output) {
  const cliPath = libPath('entry', 'cliDaemon.js');
  const daemonArgs: string[] = [cliPath, '--init-workspace', ...(args.skills ? ['--init-skills', String(args.skills)] : [])];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, daemonArgs, {
      stdio: output.installStdio(),
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

async function killAllDaemons(): Promise<number[]> {
  const platform = os.platform();
  const pidFilterEnv = process.env.PLAYWRIGHT_KILL_ALL_PID_FILTER_FOR_TEST;
  const pidFilter = pidFilterEnv ? new Set(pidFilterEnv.split(',').map(p => parseInt(p, 10)).filter(n => !isNaN(n))) : undefined;
  const killed: number[] = [];

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
        killed.push(parseInt(pid, 10));
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
              killed.push(numericPid);
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
  return killed;
}

async function collectList(registry: Registry, clientInfo: ClientInfo, all: boolean): Promise<ListData> {
  const browsers: ListedBrowser[] = [];
  const entries = registry.entryMap();
  const key = clientKey(clientInfo);
  for (const [workspaceKey, list] of entries) {
    if (!all && workspaceKey !== key)
      continue;
    for (const entry of list) {
      const session = new Session(entry);
      const canConnect = await session.canConnect();
      if (!canConnect && !session.config.cli.persistent) {
        await session.deleteSessionConfig();
        continue;
      }
      const config = session.config;
      const channel = config.browser?.launchOptions.channel ?? config.browser?.browserName;
      browsers.push({
        name: session.name,
        workspace: workspaceKey,
        status: canConnect ? 'open' : 'closed',
        browserType: channel,
        userDataDir: config.browser?.userDataDir ?? null,
        headed: config.browser ? !config.browser.launchOptions.headless : undefined,
        persistent: !!config.cli.persistent,
        attached: !!config.attached,
        compatible: session.isCompatible(clientInfo),
        version: config.version,
      });
    }
  }

  if (!all)
    return { all, browsers };

  const serverEntries = await serverRegistry.list();
  const servers = [...serverEntries.values()].flat();
  return { all, browsers, servers, channelSessions: await listChannelSessions() };
}

function validateFlags(args: MinimistArgs, command: { flags: Record<string, 'boolean' | 'string'>, help: string }, output: Output) {
  const unknownFlags: string[] = [];
  for (const key of Object.keys(args)) {
    if (key === '_')
      continue;
    if ((globalOptions as readonly string[]).includes(key))
      continue;
    if (!(key in command.flags))
      unknownFlags.push(key);
  }
  if (unknownFlags.length)
    output.errorUnknownOption(unknownFlags, command.help);
}

export function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}
