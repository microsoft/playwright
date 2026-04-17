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

import path from 'path';

import { remoteDebuggingHint } from './channelSessions';

import type { ChannelSession } from './channelSessions';

export type ListedBrowser = {
  name: string;
  workspace: string;
  status: 'open' | 'closed';
  browserType: string | undefined;
  userDataDir: string | null;
  headed: boolean | undefined;
  persistent: boolean;
  attached: boolean;
  compatible: boolean;
  version: string;
};

export type ListedServer = {
  workspace: string;
  title: string;
  browser: string;
  playwrightVersion: string;
  status: 'open' | 'closed';
  userDataDir: string | null;
};

export type ListData = {
  all: boolean;
  browsers: ListedBrowser[];
  servers?: ListedServer[];
  channelSessions?: ChannelSession[];
};

export interface Output {
  readonly json: boolean;

  version(v: string): void;
  help(text: string): void;

  errorUnknownCommand(name: string | undefined, globalHelp: string): never;
  errorUnknownOption(opts: string[], commandHelp: string): never;
  errorAttachConflict(): never;
  errorBrowserNotOpenForTool(session: string): never;

  list(data: ListData): void;
  closeAll(sessions: string[]): void;
  deleteData(session: string, result: { existed: boolean, deletedUserDataDir: boolean }): void;
  killAll(pids: number[]): void;
  open(session: string, pid: number | undefined, toolResult: string): void;
  attach(session: string, pid: number | undefined, endpoint: string | undefined, toolResult: string): void;
  close(session: string, wasOpen: boolean): void;
  installed(): void;
  show(session: string, pid: number | undefined): void;
  toolResult(text: string): void;

  installStdio(): 'inherit' | 'ignore';
}

export class TextOutput implements Output {
  readonly json = false;

  version(v: string): void {
    console.log(v);
  }

  help(text: string): void {
    console.log(text);
  }

  errorUnknownCommand(name: string | undefined, globalHelp: string): never {
    console.error(`Unknown command: ${name}\n`);
    console.log(globalHelp);
    return process.exit(1);
  }

  errorUnknownOption(opts: string[], commandHelp: string): never {
    console.error(`Unknown option${opts.length > 1 ? 's' : ''}: ${opts.map(f => `--${f}`).join(', ')}`);
    console.log('');
    console.log(commandHelp);
    return process.exit(1);
  }

  errorAttachConflict(): never {
    console.error(`Error: cannot use target name with --cdp, --endpoint, or --extension`);
    return process.exit(1);
  }

  errorBrowserNotOpenForTool(session: string): never {
    console.log(`The browser '${session}' is not open, please run open first`);
    console.log('');
    console.log(`  playwright-cli${session !== 'default' ? ` -s=${session}` : ''} open [params]`);
    return process.exit(1);
  }

  list({ all, browsers, servers, channelSessions }: ListData): void {
    const byWorkspace = new Map<string, ListedBrowser[]>();
    for (const browser of browsers) {
      let list = byWorkspace.get(browser.workspace);
      if (!list) {
        list = [];
        byWorkspace.set(browser.workspace, list);
      }
      list.push(browser);
    }

    let count = 0;
    for (const [workspaceKey, list] of byWorkspace) {
      if (count === 0)
        console.log('### Browsers');
      if (all)
        console.log(`${path.relative(process.cwd(), workspaceKey) || '/'}:`);
      for (const browser of list)
        console.log(renderBrowser(browser));
      count += list.length;
    }

    if (!all) {
      if (!count)
        console.log('  (no browsers)');
      return;
    }

    if (servers?.length) {
      if (count)
        console.log('');
      console.log('### Browser servers available for attach');
      const serversByWorkspace = new Map<string, ListedServer[]>();
      for (const server of servers) {
        let list = serversByWorkspace.get(server.workspace);
        if (!list) {
          list = [];
          serversByWorkspace.set(server.workspace, list);
        }
        list.push(server);
      }
      for (const [workspaceKey, list] of serversByWorkspace) {
        if (workspaceKey)
          console.log(`${path.relative(process.cwd(), workspaceKey) || '/'}:`);
        for (const server of list)
          console.log(renderServer(server));
      }
      count += servers.length;
    }

    if (!count)
      console.log('  (no browsers)');

    if (channelSessions?.length) {
      console.log('');
      console.log('### Browsers available to attach via CDP');
      for (const session of channelSessions)
        console.log(renderChannelSession(session));
    }
  }

  closeAll(_sessions: string[]): void {
    // Text mode is intentionally silent, matching historical behavior.
  }

  deleteData(session: string, result: { existed: boolean, deletedUserDataDir: boolean }): void {
    if (!result.existed) {
      console.log(`No user data found for browser '${session}'.`);
      return;
    }
    if (result.deletedUserDataDir)
      console.log(`Deleted user data for browser '${session}'.`);
  }

  killAll(pids: number[]): void {
    for (const pid of pids)
      console.log(`Killed daemon process ${pid}`);
    if (pids.length === 0)
      console.log('No daemon processes found.');
    else
      console.log(`Killed ${pids.length} daemon process${pids.length === 1 ? '' : 'es'}.`);
  }

  open(session: string, pid: number | undefined, toolResult: string): void {
    console.log(`### Browser \`${session}\` opened with pid ${pid}.`);
    if (toolResult)
      console.log(toolResult);
  }

  attach(session: string, pid: number | undefined, endpoint: string | undefined, toolResult: string): void {
    if (endpoint) {
      console.log(`### Session \`${session}\` created, attached to \`${endpoint}\`.`);
      console.log(`Run commands with: playwright-cli --session=${session} <command>`);
    } else {
      console.log(`### Browser \`${session}\` opened with pid ${pid}.`);
    }
    if (toolResult)
      console.log(toolResult);
  }

  close(session: string, wasOpen: boolean): void {
    if (!wasOpen) {
      console.log(`Browser '${session}' is not open.`);
      return;
    }
    console.log(`Browser '${session}' closed\n`);
  }

  installed(): void {
    // The spawned install subprocess handles its own output.
  }

  show(_session: string, pid: number | undefined): void {
    if (process.env.PLAYWRIGHT_PRINT_DASHBOARD_PID_FOR_TEST)
      console.log(`### Dashboard opened with pid ${pid}.`);
  }

  toolResult(text: string): void {
    console.log(text);
  }

  installStdio(): 'inherit' | 'ignore' {
    return 'inherit';
  }
}

export class JsonOutput implements Output {
  readonly json = true;

  version(v: string): void {
    this._emit({ version: v });
  }

  help(text: string): void {
    this._emit({ help: text });
  }

  errorUnknownCommand(name: string | undefined, _globalHelp: string): never {
    this._emit({ isError: true, error: `Unknown command: ${name}` });
    return process.exit(1);
  }

  errorUnknownOption(opts: string[], _commandHelp: string): never {
    this._emit({ isError: true, error: `Unknown option${opts.length > 1 ? 's' : ''}: ${opts.map(f => `--${f}`).join(', ')}` });
    return process.exit(1);
  }

  errorAttachConflict(): never {
    this._emit({ isError: true, error: `cannot use target name with --cdp, --endpoint, or --extension` });
    return process.exit(1);
  }

  errorBrowserNotOpenForTool(session: string): never {
    this._emit({ isError: true, error: `The browser '${session}' is not open, please run open first` });
    return process.exit(1);
  }

  list({ all, browsers, servers, channelSessions }: ListData): void {
    const payload: Record<string, unknown> = { browsers };
    if (all) {
      payload.servers = servers ?? [];
      payload.channelSessions = channelSessions ?? [];
    }
    this._emit(payload);
  }

  closeAll(sessions: string[]): void {
    this._emit({ closed: sessions });
  }

  deleteData(session: string, result: { existed: boolean, deletedUserDataDir: boolean }): void {
    this._emit({ session, deleted: result.existed });
  }

  killAll(pids: number[]): void {
    this._emit({ killed: pids.length, pids });
  }

  open(session: string, pid: number | undefined, toolResult: string): void {
    this._emit({ session, pid, result: parseJsonText(toolResult) });
  }

  attach(session: string, pid: number | undefined, endpoint: string | undefined, toolResult: string): void {
    this._emit({
      session,
      pid,
      ...(endpoint ? { endpoint } : {}),
      result: parseJsonText(toolResult),
    });
  }

  close(session: string, wasOpen: boolean): void {
    this._emit({ session, status: wasOpen ? 'closed' : 'not-open' });
  }

  installed(): void {
    this._emit({ installed: true });
  }

  show(session: string, pid: number | undefined): void {
    this._emit({ session, pid });
  }

  toolResult(text: string): void {
    // Daemon already returns pretty-printed JSON, write through verbatim.
    console.log(text);
  }

  installStdio(): 'inherit' | 'ignore' {
    return 'ignore';
  }

  private _emit(value: unknown): void {
    console.log(JSON.stringify(value, null, 2));
  }
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function renderBrowser(browser: ListedBrowser): string {
  const lines = [`- ${browser.name}:`];
  lines.push(`  - status: ${browser.status}`);
  if (browser.status === 'open' && !browser.compatible)
    lines.push(`  - version: v${browser.version} [incompatible please re-open]`);
  if (browser.browserType)
    lines.push(`  - browser-type: ${browser.browserType}${browser.attached ? ' (attached)' : ''}`);
  if (!browser.attached) {
    if (browser.userDataDir === null)
      lines.push(`  - user-data-dir: <in-memory>`);
    else
      lines.push(`  - user-data-dir: ${browser.userDataDir}`);
    if (browser.headed !== undefined)
      lines.push(`  - headed: ${browser.headed}`);
  }
  return lines.join('\n');
}

function renderServer(server: ListedServer): string {
  const lines = [`- browser "${server.title}":`];
  lines.push(`  - browser: ${server.browser}`);
  lines.push(`  - version: v${server.playwrightVersion}`);
  lines.push(`  - status: ${server.status}`);
  if (server.userDataDir)
    lines.push(`  - data-dir: ${server.userDataDir}`);
  else
    lines.push(`  - data-dir: <in-memory>`);
  lines.push(`  - run \`playwright-cli attach "${server.title}"\` to attach`);
  return lines.join('\n');
}

function renderChannelSession(session: ChannelSession): string {
  const lines = [`- ${session.channel}:`];
  lines.push(`  - data-dir: ${session.userDataDir}`);
  if (session.endpoint) {
    lines.push(`  - endpoint: ${session.endpoint}`);
    lines.push(`  - run \`playwright-cli attach --cdp=${session.channel}\` to attach`);
  } else {
    lines.push(`  - status: remote debugging not enabled`);
    lines.push(`  - ${remoteDebuggingHint(session.channel)}`);
  }
  return lines.join('\n');
}
