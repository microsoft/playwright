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
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClientInfo, Registry, resolveSessionName } from './registry';
import { Session, renderResolvedConfig } from './session';
import { serverRegistry } from '../../serverRegistry';

import type { Config } from '../mcp/config.d';
import type { ClientInfo, SessionFile } from './registry';
import type { BrowserDescriptor } from '../../serverRegistry';

type MinimistArgs = {
  _: string[];
  [key: string]: any;
};

type GlobalOptions = {
  help?: boolean;
  session?: string;
  version?: boolean;
};

type OpenOptions = {
  browser?: string;
  config?: string;
  extension?: boolean;
  headed?: boolean;
  persistent?: boolean;
  profile?: string;
};

const globalOptions: (keyof (GlobalOptions & OpenOptions))[] = [
  'browser',
  'config',
  'extension',
  'headed',
  'help',
  'persistent',
  'profile',
  'session',
  'version',
];

const booleanOptions: (keyof (GlobalOptions & OpenOptions & { all?: boolean }))[] = [
  'all',
  'help',
  'version',
];

export async function program(options?: { embedderVersion?: string}) {
  const clientInfo = createClientInfo();
  const help = require('./help.json');

  const argv = process.argv.slice(2);
  const boolean = [...help.booleanOptions, ...booleanOptions];
  const args: MinimistArgs = require('minimist')(argv, { boolean, string: ['_'] });
  for (const [key, value] of Object.entries(args)) {
    if (key !== '_' && typeof value !== 'boolean')
      args[key] = String(value);
  }
  for (let index = 0; index < args._.length; index++)
    args._[index] = String(args._[index]);
  for (const option of boolean) {
    if (!argv.includes(`--${option}`) && !argv.includes(`--no-${option}`))
      delete args[option];
    if (argv.some(arg => arg.startsWith(`--${option}=`) || arg.startsWith(`--no-${option}=`))) {
      console.error(`boolean option '--${option}' should not be passed with '=value', use '--${option}' or '--no-${option}' instead`);
      process.exit(1);
    }
  }
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
      console.log(command);
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

  const registry = await Registry.load();
  const sessionName = resolveSessionName(args.session);

  switch (commandName) {
    case 'list': {
      await listSessions(registry, clientInfo, args.all);
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
      const entry = registry.entry(clientInfo, sessionName);
      if (entry)
        await new Session(entry).stop(true);

      await Session.startDaemon(clientInfo, args);
      const newEntry = await registry.loadEntry(clientInfo, sessionName);
      await runInSession(newEntry, clientInfo, args);
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
      await install(args);
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

async function runInSession(entry: SessionFile, clientInfo: ClientInfo, args: MinimistArgs) {
  for (const globalOption of globalOptions)
    delete args[globalOption];
  const session = new Session(entry);
  const result = await session.run(clientInfo, args);
  console.log(result.text);
}

async function install(args: MinimistArgs) {
  const cwd = process.cwd();

  // Create .playwright folder to mark workspace root
  const playwrightDir = path.join(cwd, '.playwright');
  await fs.promises.mkdir(playwrightDir, { recursive: true });
  console.log(`✅ Workspace initialized at \`${cwd}\`.`);

  if (args.skills) {
    const skillSourceDir = path.join(__dirname, '../../skill');
    const skillDestDir = path.join(cwd, '.claude', 'skills', 'playwright-cli');

    if (!fs.existsSync(skillSourceDir)) {
      console.error('❌ Skills source directory not found:', skillSourceDir);
      process.exit(1);
    }

    await fs.promises.cp(skillSourceDir, skillDestDir, { recursive: true });
    console.log(`✅ Skills installed to \`${path.relative(cwd, skillDestDir)}\`.`);
  }

  await ensureConfiguredBrowserInstalled();
}

async function ensureConfiguredBrowserInstalled() {
  if (fs.existsSync(defaultConfigFile())) {
    const { registry } = await import('playwright-core/lib/server/registry/index');
    // Config exists, ensure configured browser is installed
    const data = await fs.promises.readFile(defaultConfigFile(), 'utf-8');
    const config = JSON.parse(data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data) as Config;
    const browserName = config.browser?.browserName ?? 'chromium';
    const channel = config.browser?.launchOptions?.channel;
    if (!channel || channel.startsWith('chromium')) {
      const executable = registry.findExecutable(channel ?? browserName);
      if (executable && !fs.existsSync(executable?.executablePath()!))
        await registry.install([executable]);
    }
  } else {
    // No config exists, detect or install a browser and create config
    const channel = await findOrInstallDefaultBrowser();
    if (channel !== 'chrome')
      await createDefaultConfig(channel);
  }
}

async function installBrowser() {
  const { program } = require('../../cli/program');
  const argv = process.argv.map(arg => arg === 'install-browser' ? 'install' : arg);
  program.parse(argv);
}

async function createDefaultConfig(channel: string) {
  const config: Config = {
    browser: {
      browserName: 'chromium',
      launchOptions: {
        channel,
      },
    },
  };
  await fs.promises.writeFile(defaultConfigFile(), JSON.stringify(config, null, 2));
  console.log(`✅ Created default config for ${channel} at ${path.relative(process.cwd(), defaultConfigFile())}.`);
}

async function findOrInstallDefaultBrowser() {
  const { registry } = await import('playwright-core/lib/server/registry/index');
  const channels = ['chrome', 'msedge'];
  for (const channel of channels) {
    const executable = registry.findExecutable(channel);
    if (!executable?.executablePath())
      continue;
    console.log(`✅ Found ${channel}, will use it as the default browser.`);
    return channel;
  }
  const chromiumExecutable = registry.findExecutable('chromium');
  // Unlike channels, chromium executable path is always valid, even if the browser is not installed.
  if (!fs.existsSync(chromiumExecutable?.executablePath()!))
    await registry.install([chromiumExecutable]);
  return 'chromium';
}

function defaultConfigFile(): string {
  return path.resolve('.playwright', 'cli.config.json');
}

async function killAllDaemons(): Promise<void> {
  const platform = os.platform();
  let killed = 0;

  try {
    if (platform === 'win32') {
      const result = execSync(
          `powershell -NoProfile -NonInteractive -Command `
          + `"Get-CimInstance Win32_Process `
          + `| Where-Object { $_.CommandLine -like '*run-mcp-server*' -or $_.CommandLine -like '*run-cli-server*' -or $_.CommandLine -like '*cli-daemon*' } `
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
        if (line.includes('run-mcp-server') || line.includes('run-cli-server') || line.includes('cli-daemon')) {
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
  if (all) {
    const entries = registry.entryMap();
    const serverEntries = await serverRegistry.list();
    if (entries.size === 0 && serverEntries.size === 0) {
      console.log('No browsers found.');
      return;
    }

    const runningSessions = new Set<string>();
    if (entries.size)
      console.log('### Browsers');
    for (const [workspace, list] of entries)
      await gcAndPrintSessions(clientInfo, list.map(entry => new Session(entry)), `${path.relative(process.cwd(), workspace) || '/'}:`, runningSessions);

    // Filter out server entries that already have an attached session.
    const filteredServerEntries = new Map<string, BrowserDescriptor[]>();
    for (const [workspace, list] of serverEntries) {
      const unattached = list.filter(d => !runningSessions.has(d.title));
      if (unattached.length)
        filteredServerEntries.set(workspace, unattached);
    }

    if (filteredServerEntries.size) {
      if (entries.size)
        console.log('');
      console.log('### Browser servers available for attach');
    }
    for (const [workspace, list] of filteredServerEntries)
      await gcAndPrintBrowserSessions(workspace, list);
  } else {
    console.log('### Browsers');
    const entries = registry.entries(clientInfo);
    await gcAndPrintSessions(clientInfo, entries.map(entry => new Session(entry)));
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

  if (running.length === 0 && stopped.length === 0)
    console.log('  (no browsers)');
}

async function gcAndPrintBrowserSessions(workspace: string, list: BrowserDescriptor[]) {
  if (!list.length)
    return;

  if (workspace)
    console.log(`${path.relative(process.cwd(), workspace) || '/'}:`);

  for (const descriptor of list) {
    const text: string[] = [];
    text.push(`- browser "${descriptor.title}":`);
    text.push(`  - browser: ${descriptor.browser.browserName}`);
    text.push(`  - version: v${descriptor.playwrightVersion}`);
    text.push(`  - run \`playwright-cli open --attach "${descriptor.title}"\` to attach`);
    console.log(text.join('\n'));
  }

  if (!list.length)
    console.log('  (no browsers)');
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

export function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}
