/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';

import { TraceModel, buildActionTree } from '../../utils/isomorphic/trace/traceModel';
import { TraceLoader } from '../../utils/isomorphic/trace/traceLoader';
import { renderTitleForCall } from '../../utils/isomorphic/protocolFormatter';
import { asLocatorDescription } from '../../utils/isomorphic/locatorGenerators';
import { ZipTraceLoaderBackend } from './traceParser';

import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel';
import type { Language } from '@isomorphic/locatorGenerators';
import type { Command } from '../../utilsBundle';

export function addTraceCommands(program: Command, logErrorAndExit: (e: Error) => void) {
  const traceCommand = program
      .command('trace')
      .description('inspect trace files from the command line');

  traceCommand
      .command('info <trace>')
      .description('show trace metadata')
      .action(function(trace: string) {
        traceInfo(trace).catch(logErrorAndExit);
      });

  traceCommand
      .command('actions <trace>')
      .description('list actions in the trace')
      .option('--grep <pattern>', 'filter actions by title pattern')
      .option('--errors-only', 'only show failed actions')
      .action(function(trace: string, options: { grep?: string, errorsOnly?: boolean }) {
        traceActions(trace, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('action <trace> <action-id>')
      .description('show details of a specific action')
      .action(function(trace: string, actionId: string) {
        traceAction(trace, actionId).catch(logErrorAndExit);
      });

  traceCommand
      .command('requests <trace>')
      .description('show network requests')
      .option('--grep <pattern>', 'filter by URL pattern')
      .option('--method <method>', 'filter by HTTP method')
      .option('--status <code>', 'filter by status code')
      .option('--failed', 'only show failed requests (status >= 400)')
      .action(function(trace: string, options: { grep?: string, method?: string, status?: string, failed?: boolean }) {
        traceRequests(trace, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('request <trace> <request-id>')
      .description('show details of a specific network request')
      .action(function(trace: string, requestId: string) {
        traceRequest(trace, requestId).catch(logErrorAndExit);
      });

  traceCommand
      .command('console <trace>')
      .description('show console messages')
      .option('--errors-only', 'only show errors')
      .option('--warnings', 'show errors and warnings')
      .option('--browser', 'only browser console messages')
      .option('--stdio', 'only stdout/stderr')
      .action(function(trace: string, options: { errorsOnly?: boolean, warnings?: boolean, browser?: boolean, stdio?: boolean }) {
        traceConsole(trace, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('errors <trace>')
      .description('show errors with stack traces')
      .action(function(trace: string) {
        traceErrors(trace).catch(logErrorAndExit);
      });

  traceCommand
      .command('snapshot <trace> <action-id>')
      .description('save or serve DOM snapshot for an action')
      .option('--name <name>', 'snapshot phase: before, input, or after', 'before')
      .option('-o, --output <path>', 'output file path')
      .option('--serve', 'serve snapshot on local HTTP server')
      .option('--port <port>', 'port for serve mode')
      .action(function(trace: string, actionId: string, options: { name?: string, output?: string, serve?: boolean, port?: number }) {
        traceSnapshot(trace, actionId, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('screenshot <trace> <action-id>')
      .description('save screencast screenshot for an action')
      .option('-o, --output <path>', 'output file path')
      .action(function(trace: string, actionId: string, options: { output?: string }) {
        traceScreenshot(trace, actionId, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('attachments <trace>')
      .description('list trace attachments')
      .action(function(trace: string) {
        traceAttachments(trace).catch(logErrorAndExit);
      });

  traceCommand
      .command('attachment <trace> <attachment-id>')
      .description('extract a trace attachment by its number')
      .option('-o, --output <path>', 'output file path')
      .action(function(trace: string, attachmentId: string, options: { output?: string }) {
        traceAttachment(trace, attachmentId, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('install-skill')
      .description('install SKILL.md for LLM integration')
      .action(function() {
        installSkill().catch(logErrorAndExit);
      });
}

export async function loadTrace(traceFile: string): Promise<{ model: TraceModel, loader: TraceLoader }> {
  const filePath = path.resolve(traceFile);
  if (!fs.existsSync(filePath))
    throw new Error(`Trace file not found: ${filePath}`);
  const backend = new ZipTraceLoaderBackend(filePath);
  const loader = new TraceLoader();
  await loader.load(backend, () => undefined);
  return { model: new TraceModel(filePath, loader.contextEntries), loader };
}

export async function loadTraceModel(traceFile: string): Promise<TraceModel> {
  return (await loadTrace(traceFile)).model;
}

function msToString(ms: number): string {
  if (ms < 0 || !isFinite(ms))
    return '-';
  if (ms === 0)
    return '0';
  if (ms < 1000)
    return ms.toFixed(0) + 'ms';
  const seconds = ms / 1000;
  if (seconds < 60)
    return seconds.toFixed(1) + 's';
  const minutes = seconds / 60;
  if (minutes < 60)
    return minutes.toFixed(1) + 'm';
  const hours = minutes / 60;
  if (hours < 24)
    return hours.toFixed(1) + 'h';
  const days = hours / 24;
  return days.toFixed(1) + 'd';
}

function bytesToString(bytes: number): string {
  if (bytes < 0 || !isFinite(bytes))
    return '-';
  if (bytes === 0)
    return '0';
  if (bytes < 1000)
    return bytes.toFixed(0);
  const kb = bytes / 1024;
  if (kb < 1000)
    return kb.toFixed(1) + 'K';
  const mb = kb / 1024;
  if (mb < 1000)
    return mb.toFixed(1) + 'M';
  const gb = mb / 1024;
  return gb.toFixed(1) + 'G';
}

function formatTimestamp(ms: number, base: number): string {
  const relative = ms - base;
  if (relative < 0)
    return '0:00.000';
  const totalMs = Math.floor(relative);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function actionTitle(action: ActionTraceEventInContext, sdkLanguage?: Language): string {
  return renderTitleForCall({ ...action, type: action.class }) || `${action.class}.${action.method}`;
}

function actionLocator(action: ActionTraceEventInContext, sdkLanguage?: Language): string | undefined {
  return action.params.selector ? asLocatorDescription(sdkLanguage || 'javascript', action.params.selector) : undefined;
}

const cliOutputDir = '.playwright-cli';

async function saveOutputFile(fileName: string, content: string | Buffer, explicitOutput?: string): Promise<string> {
  let outFile: string;
  if (explicitOutput) {
    outFile = explicitOutput;
  } else {
    await fs.promises.mkdir(cliOutputDir, { recursive: true });
    outFile = path.join(cliOutputDir, fileName);
  }
  await fs.promises.writeFile(outFile, content);
  return outFile;
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function padStart(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

// ---- ordinal mapping ----

function buildOrdinalMap(model: TraceModel): { ordinalToCallId: Map<number, string>, callIdToOrdinal: Map<string, number> } {
  const actions = model.actions.filter(a => a.group !== 'configuration');
  const { rootItem } = buildActionTree(actions);
  const ordinalToCallId = new Map<number, string>();
  const callIdToOrdinal = new Map<string, number>();
  let ordinal = 1;
  const visit = (item: ReturnType<typeof buildActionTree>['rootItem']) => {
    ordinalToCallId.set(ordinal, item.action.callId);
    callIdToOrdinal.set(item.action.callId, ordinal);
    ordinal++;
    for (const child of item.children)
      visit(child);
  };
  for (const child of rootItem.children)
    visit(child);
  return { ordinalToCallId, callIdToOrdinal };
}

function resolveActionId(actionId: string, model: TraceModel): ActionTraceEventInContext | undefined {
  const ordinal = parseInt(actionId, 10);
  if (!isNaN(ordinal)) {
    const { ordinalToCallId } = buildOrdinalMap(model);
    const callId = ordinalToCallId.get(ordinal);
    if (callId)
      return model.actions.find(a => a.callId === callId);
  }
  return model.actions.find(a => a.callId === actionId);
}

// ---- trace actions ----

export async function traceActions(traceFile: string, options: { grep?: string, errorsOnly?: boolean }) {
  const model = await loadTraceModel(traceFile);
  const lang = model.sdkLanguage;
  const { callIdToOrdinal } = buildOrdinalMap(model);
  const actions = filterActions(model.actions, options, lang);

  // Tree view
  const { rootItem } = buildActionTree(actions);
  console.log(`  ${padStart('#', 4)} ${padEnd('Time', 9)}  ${padEnd('Action', 55)} ${padStart('Duration', 8)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(9)}  ${'─'.repeat(55)} ${'─'.repeat(8)}`);
  const visit = (item: ReturnType<typeof buildActionTree>['rootItem'], indent: string) => {
    const action = item.action;
    const ordinal = callIdToOrdinal.get(action.callId) ?? '?';
    const ts = formatTimestamp(action.startTime, model.startTime);
    const duration = action.endTime ? msToString(action.endTime - action.startTime) : 'running';
    const title = actionTitle(action as ActionTraceEventInContext, lang);
    const locator = actionLocator(action as ActionTraceEventInContext, lang);
    const error = action.error ? '  ✗' : '';
    const prefix = `  ${padStart(ordinal + '.', 4)} ${ts}  ${indent}`;
    console.log(`${prefix}${padEnd(title, Math.max(1, 55 - indent.length))} ${padStart(duration, 8)}${error}`);
    if (locator)
      console.log(`${' '.repeat(prefix.length)}${locator}`);
    for (const child of item.children)
      visit(child, indent + '  ');
  };
  for (const child of rootItem.children)
    visit(child, '');
}

function filterActions(actions: ActionTraceEventInContext[], options: { grep?: string, errorsOnly?: boolean }, lang?: Language): ActionTraceEventInContext[] {
  let result = actions.filter(a => a.group !== 'configuration');
  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    result = result.filter(a => pattern.test(actionTitle(a, lang)) || pattern.test(actionLocator(a, lang) || ''));
  }
  if (options.errorsOnly)
    result = result.filter(a => !!a.error);
  return result;
}

// ---- trace action ----

export async function traceAction(traceFile: string, actionId: string) {
  const model = await loadTraceModel(traceFile);
  const lang = model.sdkLanguage;
  const action = resolveActionId(actionId, model);
  if (!action) {
    console.error(`Action '${actionId}' not found. Use 'trace actions' to see available action IDs.`);
    process.exitCode = 1;
    return;
  }

  const title = actionTitle(action, lang);
  console.log(`\n  ${title}\n`);

  // Time
  console.log('  Time');
  console.log(`    start:     ${formatTimestamp(action.startTime, model.startTime)}`);
  const duration = action.endTime ? msToString(action.endTime - action.startTime) : (action.error ? 'Timed Out' : 'Running');
  console.log(`    duration:  ${duration}`);

  // Parameters
  const paramKeys = Object.keys(action.params).filter(name => name !== 'info');
  if (paramKeys.length) {
    console.log('\n  Parameters');
    for (const key of paramKeys) {
      const value = formatParamValue(action.params[key]);
      console.log(`    ${key}: ${value}`);
    }
  }

  // Return value
  if (action.result) {
    console.log('\n  Return value');
    for (const [key, value] of Object.entries(action.result))
      console.log(`    ${key}: ${formatParamValue(value)}`);

  }

  // Error
  if (action.error) {
    console.log('\n  Error');
    console.log(`    ${action.error.message}`);
  }

  // Logs
  if (action.log.length) {
    console.log('\n  Log');
    for (const entry of action.log) {
      const time = entry.time !== -1 ? formatTimestamp(entry.time, model.startTime) : '';
      console.log(`    ${padEnd(time, 12)} ${entry.message}`);
    }
  }

  // Source
  if (action.stack?.length) {
    console.log('\n  Source');
    for (const frame of action.stack.slice(0, 5)) {
      const file = frame.file.replace(/.*[/\\](.*)/, '$1');
      console.log(`    ${file}:${frame.line}:${frame.column}`);
    }
  }

  // Snapshots
  const snapshots: string[] = [];
  if (action.beforeSnapshot)
    snapshots.push('before');
  if (action.inputSnapshot)
    snapshots.push('input');
  if (action.afterSnapshot)
    snapshots.push('after');
  if (snapshots.length) {
    console.log('\n  Snapshots');
    console.log(`    available: ${snapshots.join(', ')}`);
    console.log(`    usage:     npx playwright trace snapshot <trace> ${actionId} --name <${snapshots.join('|')}>`);
  }
  console.log('');
}

function formatParamValue(value: any): string {
  if (value === undefined || value === null)
    return String(value);
  if (typeof value === 'string')
    return `"${value}"`;
  if (typeof value !== 'object')
    return String(value);
  if (value.guid)
    return '<handle>';
  return JSON.stringify(value).slice(0, 1000);
}

// ---- trace requests ----

export async function traceRequests(traceFile: string, options: { grep?: string, method?: string, status?: string, failed?: boolean }) {
  const model = await loadTraceModel(traceFile);

  // Build indexed list with stable ordinals before filtering.
  let indexed = model.resources.map((r, i) => ({ resource: r, ordinal: i + 1 }));

  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    indexed = indexed.filter(({ resource: r }) => pattern.test(r.request.url));
  }
  if (options.method)
    indexed = indexed.filter(({ resource: r }) => r.request.method.toLowerCase() === options.method!.toLowerCase());
  if (options.status) {
    const code = parseInt(options.status, 10);
    indexed = indexed.filter(({ resource: r }) => r.response.status === code);
  }
  if (options.failed)
    indexed = indexed.filter(({ resource: r }) => r.response.status >= 400 || r.response.status === -1);

  if (!indexed.length) {
    console.log('  No network requests');
    return;
  }
  console.log(`  ${padStart('#', 4)} ${padEnd('Method', 8)} ${padEnd('Status', 8)} ${padEnd('Name', 45)} ${padStart('Duration', 10)} ${padStart('Size', 8)} ${padEnd('Route', 10)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(45)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(10)}`);

  for (const { resource: r, ordinal } of indexed) {
    let name: string;
    try {
      const url = new URL(r.request.url);
      name = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
      if (!name)
        name = url.host;
      if (url.search)
        name += url.search;
    } catch {
      name = r.request.url;
    }
    if (name.length > 45)
      name = name.substring(0, 42) + '...';

    const status = r.response.status > 0 ? String(r.response.status) : 'ERR';
    const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;
    const route = formatRouteStatus(r);
    console.log(`  ${padStart(ordinal + '.', 4)} ${padEnd(r.request.method, 8)} ${padEnd(status, 8)} ${padEnd(name, 45)} ${padStart(msToString(r.time), 10)} ${padStart(bytesToString(size), 8)} ${padEnd(route, 10)}`);
  }
}

// ---- trace request ----

export async function traceRequest(traceFile: string, requestId: string) {
  const model = await loadTraceModel(traceFile);
  const ordinal = parseInt(requestId, 10);
  const resource = !isNaN(ordinal) && ordinal >= 1 && ordinal <= model.resources.length
    ? model.resources[ordinal - 1]
    : undefined;

  if (!resource) {
    console.error(`Request '${requestId}' not found. Use 'trace requests' to see available request IDs.`);
    process.exitCode = 1;
    return;
  }

  const r = resource;
  const status = r.response.status > 0 ? `${r.response.status} ${r.response.statusText}` : 'ERR';
  const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;

  console.log(`\n  ${r.request.method} ${r.request.url}\n`);

  // General
  console.log('  General');
  console.log(`    status:    ${status}`);
  console.log(`    duration:  ${msToString(r.time)}`);
  console.log(`    size:      ${bytesToString(size)}`);
  if (r.response.content.mimeType)
    console.log(`    type:      ${r.response.content.mimeType}`);
  const route = formatRouteStatus(r);
  if (route)
    console.log(`    route:     ${route}`);
  if (r.serverIPAddress)
    console.log(`    server:    ${r.serverIPAddress}${r._serverPort ? ':' + r._serverPort : ''}`);
  if (r.response._failureText)
    console.log(`    error:     ${r.response._failureText}`);

  // Request headers
  if (r.request.headers.length) {
    console.log('\n  Request headers');
    for (const h of r.request.headers)
      console.log(`    ${h.name}: ${h.value}`);
  }

  // Request body
  if (r.request.postData) {
    console.log('\n  Request body');
    console.log(`    type: ${r.request.postData.mimeType}`);
    if (r.request.postData.text) {
      const text = r.request.postData.text.length > 2000
        ? r.request.postData.text.substring(0, 2000) + '...'
        : r.request.postData.text;
      console.log(`    ${text}`);
    }
  }

  // Response headers
  if (r.response.headers.length) {
    console.log('\n  Response headers');
    for (const h of r.response.headers)
      console.log(`    ${h.name}: ${h.value}`);
  }

  // Security
  if (r._securityDetails) {
    console.log('\n  Security');
    if (r._securityDetails.protocol)
      console.log(`    protocol:  ${r._securityDetails.protocol}`);
    if (r._securityDetails.subjectName)
      console.log(`    subject:   ${r._securityDetails.subjectName}`);
    if (r._securityDetails.issuer)
      console.log(`    issuer:    ${r._securityDetails.issuer}`);
  }

  console.log('');
}

function formatRouteStatus(r: { _wasAborted?: boolean, _wasContinued?: boolean, _wasFulfilled?: boolean, _apiRequest?: boolean }): string {
  if (r._wasAborted)
    return 'aborted';
  if (r._wasContinued)
    return 'continued';
  if (r._wasFulfilled)
    return 'fulfilled';
  if (r._apiRequest)
    return 'api';
  return '';
}

// ---- trace console ----

export async function traceConsole(traceFile: string, options: { errorsOnly?: boolean, warnings?: boolean, browser?: boolean, stdio?: boolean }) {
  const model = await loadTraceModel(traceFile);

  type ConsoleItem = {
    type: 'browser' | 'stdout' | 'stderr';
    level: string;
    text: string;
    location?: string;
    timestamp: number;
  };

  const items: ConsoleItem[] = [];

  for (const event of model.events) {
    if (event.type === 'console') {
      if (options.stdio)
        continue;
      const level = event.messageType;
      if (options.errorsOnly && level !== 'error')
        continue;
      if (options.warnings && level !== 'error' && level !== 'warning')
        continue;
      const url = event.location.url;
      const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
      items.push({
        type: 'browser',
        level,
        text: event.text,
        location: `${filename}:${event.location.lineNumber}`,
        timestamp: event.time,
      });
    }
    if (event.type === 'event' && event.method === 'pageError') {
      if (options.stdio)
        continue;
      const error = event.params.error;
      items.push({
        type: 'browser',
        level: 'error',
        text: error?.error?.message || String(error?.value || ''),
        timestamp: event.time,
      });
    }
  }

  for (const event of model.stdio) {
    if (options.browser)
      continue;
    if (options.errorsOnly && event.type !== 'stderr')
      continue;
    if (options.warnings && event.type !== 'stderr')
      continue;
    let text = '';
    if (event.text)
      text = event.text.trim();
    if (event.base64)
      text = Buffer.from(event.base64, 'base64').toString('utf-8').trim();
    if (!text)
      continue;
    items.push({
      type: event.type as 'stdout' | 'stderr',
      level: event.type === 'stderr' ? 'error' : 'info',
      text,
      timestamp: event.timestamp,
    });
  }

  items.sort((a, b) => a.timestamp - b.timestamp);

  if (!items.length) {
    console.log('  No console entries');
    return;
  }

  for (const item of items) {
    const ts = formatTimestamp(item.timestamp, model.startTime);
    const source = item.type === 'browser' ? '[browser]' : `[${item.type}]`;
    const level = padEnd(item.level, 8);
    const location = item.location ? `  ${item.location}` : '';
    console.log(`  ${ts}  ${padEnd(source, 10)} ${level} ${item.text}${location}`);
  }
}

// ---- trace errors ----

export async function traceErrors(traceFile: string) {
  const model = await loadTraceModel(traceFile);
  const lang = model.sdkLanguage;

  if (!model.errorDescriptors.length) {
    console.log('  No errors');
    return;
  }

  for (const error of model.errorDescriptors) {
    if (error.action) {
      const title = actionTitle(error.action, lang);
      console.log(`\n  ✗ ${title}`);
    } else {
      console.log(`\n  ✗ Error`);
    }

    if (error.stack?.length) {
      const frame = error.stack[0];
      const file = frame.file.replace(/.*[/\\](.*)/, '$1');
      console.log(`    at ${file}:${frame.line}:${frame.column}`);
    }
    console.log('');
    const indented = error.message.split('\n').map(l => `    ${l}`).join('\n');
    console.log(indented);
  }
  console.log('');
}

// ---- trace snapshot ----

export async function traceSnapshot(traceFile: string, actionId: string, options: { name?: string, output?: string, serve?: boolean, port?: number }) {
  const { model, loader } = await loadTrace(traceFile);

  const action = resolveActionId(actionId, model);
  if (!action) {
    console.error(`Action '${actionId}' not found.`);
    process.exitCode = 1;
    return;
  }

  const pageId = action.pageId;
  if (!pageId) {
    console.error(`Action '${actionId}' has no associated page.`);
    process.exitCode = 1;
    return;
  }

  const callId = action.callId;
  const storage = loader.storage();

  let snapshotName: string | undefined;
  let renderer;
  if (options.name) {
    snapshotName = options.name;
    renderer = storage.snapshotByName(pageId, `${snapshotName}@${callId}`);
  } else {
    for (const candidate of ['input', 'before', 'after']) {
      renderer = storage.snapshotByName(pageId, `${candidate}@${callId}`);
      if (renderer) {
        snapshotName = candidate;
        break;
      }
    }
  }

  if (!renderer || !snapshotName) {
    console.error(`No snapshot found for action '${actionId}'.`);
    process.exitCode = 1;
    return;
  }

  const snapshotKey = `${snapshotName}@${callId}`;

  const rendered = renderer.render();
  const defaultName = `snapshot-${actionId}-${snapshotName}.html`;

  if (options.serve) {
    const { SnapshotServer } = require('../../utils/isomorphic/trace/snapshotServer') as typeof import('../../utils/isomorphic/trace/snapshotServer');
    const { HttpServer } = require('../../server/utils/httpServer') as typeof import('../../server/utils/httpServer');

    const snapshotServer = new SnapshotServer(storage, sha1 => loader.resourceForSha1(sha1));
    const httpServer = new HttpServer();

    httpServer.routePrefix('/snapshot', (request, response) => {
      const url = new URL('http://localhost' + request.url!);
      const searchParams = url.searchParams;
      searchParams.set('name', snapshotKey);
      const snapshotResponse = snapshotServer.serveSnapshot(pageId, searchParams, '/snapshot');
      response.statusCode = snapshotResponse.status;
      snapshotResponse.headers.forEach((value, key) => response.setHeader(key, value));
      snapshotResponse.text().then(text => response.end(text));
      return true;
    });

    httpServer.routePrefix('/', (request, response) => {
      response.statusCode = 302;
      response.setHeader('Location', '/snapshot');
      response.end();
      return true;
    });

    await httpServer.start({ preferredPort: options.port || 0 });
    console.log(`Snapshot served at ${httpServer.urlPrefix('human-readable')}`);
    return;
  }

  const outFile = await saveOutputFile(defaultName, rendered.html, options.output);
  console.log(`  Snapshot saved to ${outFile}`);
}

// ---- trace screenshot ----

export async function traceScreenshot(traceFile: string, actionId: string, options: { output?: string }) {
  const { model, loader } = await loadTrace(traceFile);

  const action = resolveActionId(actionId, model);
  if (!action) {
    console.error(`Action '${actionId}' not found.`);
    process.exitCode = 1;
    return;
  }

  const pageId = action.pageId;
  if (!pageId) {
    console.error(`Action '${actionId}' has no associated page.`);
    process.exitCode = 1;
    return;
  }

  const callId = action.callId;
  const storage = loader.storage();
  const snapshotNames = ['input', 'before', 'after'];
  let sha1: string | undefined;
  for (const name of snapshotNames) {
    const renderer = storage.snapshotByName(pageId, `${name}@${callId}`);
    sha1 = renderer?.closestScreenshot();
    if (sha1)
      break;
  }

  if (!sha1) {
    console.error(`No screenshot found for action '${actionId}'.`);
    process.exitCode = 1;
    return;
  }

  const blob = await loader.resourceForSha1(sha1);
  if (!blob) {
    console.error(`Screenshot resource not found.`);
    process.exitCode = 1;
    return;
  }

  const defaultName = `screenshot-${actionId}.png`;
  const buffer = Buffer.from(await blob.arrayBuffer());
  const outFile = await saveOutputFile(defaultName, buffer, options.output);
  console.log(`  Screenshot saved to ${outFile}`);
}

// ---- trace attachments ----

export async function traceAttachments(traceFile: string) {
  const model = await loadTraceModel(traceFile);

  if (!model.attachments.length) {
    console.log('  No attachments');
    return;
  }
  const { callIdToOrdinal } = buildOrdinalMap(model);
  console.log(`  ${padStart('#', 4)} ${padEnd('Name', 40)} ${padEnd('Content-Type', 30)} ${padEnd('Action', 8)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(40)} ${'─'.repeat(30)} ${'─'.repeat(8)}`);
  for (let i = 0; i < model.attachments.length; i++) {
    const a = model.attachments[i];
    const actionOrdinal = callIdToOrdinal.get(a.callId);
    console.log(`  ${padStart((i + 1) + '.', 4)} ${padEnd(a.name, 40)} ${padEnd(a.contentType, 30)} ${padEnd(actionOrdinal !== undefined ? String(actionOrdinal) : a.callId, 8)}`);
  }
}

// ---- trace attachment ----

export async function traceAttachment(traceFile: string, attachmentId: string, options: { output?: string }) {
  const { model, loader } = await loadTrace(traceFile);

  const ordinal = parseInt(attachmentId, 10);
  const attachment = !isNaN(ordinal) && ordinal >= 1 && ordinal <= model.attachments.length
    ? model.attachments[ordinal - 1]
    : undefined;

  if (!attachment) {
    console.error(`Attachment '${attachmentId}' not found. Use 'trace attachments' to see available attachments.`);
    process.exitCode = 1;
    return;
  }

  let content: Buffer | undefined;
  if (attachment.sha1) {
    const blob = await loader.resourceForSha1(attachment.sha1);
    if (blob)
      content = Buffer.from(await blob.arrayBuffer());
  } else if (attachment.base64) {
    content = Buffer.from(attachment.base64, 'base64');
  }

  if (!content) {
    console.error(`Could not extract attachment content.`);
    process.exitCode = 1;
    return;
  }

  const outFile = await saveOutputFile(attachment.name, content, options.output);
  console.log(`  Attachment saved to ${outFile}`);
}

// ---- trace info ----

export async function traceInfo(traceFile: string) {
  const model = await loadTraceModel(traceFile);

  const info = {
    browser: model.browserName || 'unknown',
    platform: model.platform || 'unknown',
    playwrightVersion: model.playwrightVersion || 'unknown',
    title: model.title || '',
    duration: msToString(model.endTime - model.startTime),
    durationMs: model.endTime - model.startTime,
    startTime: model.wallTime ? new Date(model.wallTime).toISOString() : 'unknown',
    viewport: model.options.viewport ? `${model.options.viewport.width}x${model.options.viewport.height}` : 'default',
    actions: model.actions.length,
    pages: model.pages.length,
    network: model.resources.length,
    errors: model.errorDescriptors.length,
    attachments: model.attachments.length,
    consoleMessages: model.events.filter(e => e.type === 'console').length,
  };

  console.log('');
  console.log(`  Browser:      ${info.browser}`);
  console.log(`  Platform:     ${info.platform}`);
  console.log(`  Playwright:   ${info.playwrightVersion}`);
  if (info.title)
    console.log(`  Title:        ${info.title}`);
  console.log(`  Duration:     ${info.duration}`);
  console.log(`  Start time:   ${info.startTime}`);
  console.log(`  Viewport:     ${info.viewport}`);
  console.log(`  Actions:      ${info.actions}`);
  console.log(`  Pages:        ${info.pages}`);
  console.log(`  Network:      ${info.network} requests`);
  console.log(`  Errors:       ${info.errors}`);
  console.log(`  Attachments:  ${info.attachments}`);
  console.log(`  Console:      ${info.consoleMessages} messages`);
  console.log('');
}

// ---- install-skill ----

async function installSkill() {
  const cwd = process.cwd();
  const skillSource = path.join(__dirname, 'SKILL.md');
  const destDir = path.join(cwd, '.claude', 'playwright-trace');
  await fs.promises.mkdir(destDir, { recursive: true });
  const destFile = path.join(destDir, 'SKILL.md');
  await fs.promises.copyFile(skillSource, destFile);
  console.log(`✅ Skill installed to \`${path.relative(cwd, destFile)}\`.`);
}
