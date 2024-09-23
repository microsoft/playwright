/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import type { Frame, Page } from 'playwright-core';
import { ZipFile } from '../../packages/playwright-core/lib/utils/zipFile';
import type { TraceModelBackend } from '../../packages/trace-viewer/src/traceModel';
import type { StackFrame } from '../../packages/protocol/src/channels';
import { parseClientSideCallMetadata } from '../../packages/playwright-core/lib/utils/isomorphic/traceUtils';
import { TraceModel } from '../../packages/trace-viewer/src/traceModel';
import type { ActionTreeItem } from '../../packages/trace-viewer/src/ui/modelUtil';
import { buildActionTree, MultiTraceModel } from '../../packages/trace-viewer/src/ui/modelUtil';
import type { ActionTraceEvent, ConsoleMessageTraceEvent, EventTraceEvent, TraceEvent } from '@trace/trace';
import style from 'ansi-styles';

export async function attachFrame(page: Page, frameId: string, url: string): Promise<Frame> {
  const handle = await page.evaluateHandle(async ({ frameId, url }) => {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.id = frameId;
    document.body.appendChild(frame);
    await new Promise(x => frame.onload = x);
    return frame;
  }, { frameId, url });
  return handle.asElement().contentFrame() as Promise<Frame>;
}

export async function detachFrame(page: Page, frameId: string) {
  await page.evaluate(frameId => {
    document.getElementById(frameId)!.remove();
  }, frameId);
}

export async function verifyViewport(page: Page, width: number, height: number) {
  // `expect` may clash in test runner tests if imported eagerly.
  const { expect } = require('@playwright/test');
  expect(page.viewportSize()!.width).toBe(width);
  expect(page.viewportSize()!.height).toBe(height);
  expect(await page.evaluate('window.innerWidth')).toBe(width);
  expect(await page.evaluate('window.innerHeight')).toBe(height);
}

export function expectedSSLError(browserName: string, platform: string): RegExp {
  if (browserName === 'chromium')
    return /net::(ERR_CERT_AUTHORITY_INVALID|ERR_CERT_INVALID)/;
  if (browserName === 'webkit') {
    if (platform === 'darwin')
      return /The certificate for this server is invalid/;
    else if (platform === 'win32')
      return /SSL peer certificate or SSH remote key was not OK/;
    else
      return /Unacceptable TLS certificate/;
  }
  return /SSL_ERROR_UNKNOWN/;
}

export function chromiumVersionLessThan(a: string, b: string) {
  const left: number[] = a.split('.').map(e => Number(e));
  const right: number[] = b.split('.').map(e => Number(e));
  for (let i = 0; i < 4; i++) {
    if (left[i] > right[i])
      return false;
    if (left[i] < right[i])
      return true;
  }
  return false;
}

let didSuppressUnverifiedCertificateWarning = false;
let originalEmitWarning: (warning: string | Error, ...args: any[]) => void;
export function suppressCertificateWarning() {
  if (didSuppressUnverifiedCertificateWarning)
    return;
  didSuppressUnverifiedCertificateWarning = true;
  // Suppress one-time warning:
  // https://github.com/nodejs/node/blob/1bbe66f432591aea83555d27dd76c55fea040a0d/lib/internal/options.js#L37-L49
  originalEmitWarning = process.emitWarning;
  process.emitWarning = (warning, ...args) => {
    if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
      process.emitWarning = originalEmitWarning;
      return;
    }
    return originalEmitWarning.call(process, warning, ...args);
  };
}

export async function parseTraceRaw(file: string): Promise<{ events: any[], resources: Map<string, Buffer>, actions: string[], actionObjects: ActionTraceEvent[], stacks: Map<string, StackFrame[]> }> {
  const zipFS = new ZipFile(file);
  const resources = new Map<string, Buffer>();
  for (const entry of await zipFS.entries())
    resources.set(entry, await zipFS.read(entry));
  zipFS.close();

  const actionMap = new Map<string, ActionTraceEvent>();
  const events: any[] = [];
  for (const traceFile of [...resources.keys()].filter(name => name.endsWith('.trace'))) {
    for (const line of resources.get(traceFile)!.toString().split('\n')) {
      if (line) {
        const event = JSON.parse(line) as TraceEvent;
        events.push(event);

        if (event.type === 'before') {
          const action: ActionTraceEvent = {
            ...event,
            type: 'action',
            endTime: 0,
          };
          actionMap.set(event.callId, action);
        } else if (event.type === 'input') {
          const existing = actionMap.get(event.callId);
          existing.inputSnapshot = event.inputSnapshot;
          existing.point = event.point;
        } else if (event.type === 'after') {
          const existing = actionMap.get(event.callId);
          existing.afterSnapshot = event.afterSnapshot;
          existing.endTime = event.endTime;
          existing.error = event.error;
          existing.result = event.result;
        }
      }
    }
  }

  for (const networkFile of [...resources.keys()].filter(name => name.endsWith('.network'))) {
    for (const line of resources.get(networkFile)!.toString().split('\n')) {
      if (line)
        events.push(JSON.parse(line));
    }
  }

  const stacks: Map<string, StackFrame[]> = new Map();
  for (const stacksFile of [...resources.keys()].filter(name => name.endsWith('.stacks'))) {
    for (const [key, value] of parseClientSideCallMetadata(JSON.parse(resources.get(stacksFile)!.toString())))
      stacks.set(key, value);
  }

  const actionObjects = [...actionMap.values()];
  actionObjects.sort((a, b) => a.startTime - b.startTime);
  return {
    events,
    resources,
    actions: actionObjects.map(a => a.apiName),
    actionObjects,
    stacks,
  };
}

export async function parseTrace(file: string): Promise<{ resources: Map<string, Buffer>, events: (EventTraceEvent | ConsoleMessageTraceEvent)[], actions: ActionTraceEvent[], apiNames: string[], traceModel: TraceModel, model: MultiTraceModel, actionTree: string[], errors: string[] }> {
  const backend = new TraceBackend(file);
  const traceModel = new TraceModel();
  await traceModel.load(backend, false, () => {});
  const model = new MultiTraceModel(traceModel.contextEntries);
  const { rootItem } = buildActionTree(model.actions);
  const actionTree: string[] = [];
  const visit = (actionItem: ActionTreeItem, indent: string) => {
    actionTree.push(`${indent}${actionItem.action?.apiName || actionItem.id}`);
    for (const child of actionItem.children)
      visit(child, indent + '  ');
  };
  rootItem.children.forEach(a => visit(a, ''));
  return {
    apiNames: model.actions.map(a => a.apiName),
    resources: backend.entries,
    actions: model.actions,
    events: model.events,
    errors: model.errors.map(e => e.message),
    model,
    traceModel,
    actionTree,
  };
}

export async function parseHar(file: string): Promise<Map<string, Buffer>> {
  const zipFS = new ZipFile(file);
  const resources = new Map<string, Buffer>();
  for (const entry of await zipFS.entries())
    resources.set(entry, await zipFS.read(entry));
  zipFS.close();
  return resources;
}

export function waitForTestLog<T>(page: Page, prefix: string): Promise<T> {
  return new Promise<T>(resolve => {
    page.on('console', message => {
      const text = message.text();
      if (text.startsWith(prefix)) {
        const json = text.substring(prefix.length);
        resolve(JSON.parse(json));
      }
    });
  });
}

const ansiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAnsi(str: string): string {
  return str.replace(ansiRegex, '');
}

export function ansi2Markup(text: string): string {
  return text.replace(ansiRegex, match => {
    switch (match) {
      case style.inverse.open:
        return '<i>';
      case style.inverse.close:
        return '</i>';

      case style.bold.open:
        return '<b>';
      case style.dim.open:
        return '<d>';
      case style.green.open:
        return '<g>';
      case style.red.open:
        return '<r>';
      case style.yellow.open:
        return '<y>';
      case style.bgYellow.open:
        return '<Y>';

      case style.bold.close:
      case style.dim.close:
      case style.green.close:
      case style.red.close:
      case style.yellow.close:
      case style.bgYellow.close:
        return '</>';

      default:
        return match; // unexpected escape sequence
    }
  });
}

class TraceBackend implements TraceModelBackend {
  private _fileName: string;
  private _entriesPromise: Promise<Map<string, Buffer>>;
  readonly entries = new Map<string, Buffer>();

  constructor(fileName: string) {
    this._fileName = fileName;
    this._entriesPromise = this._readEntries();
  }

  private async _readEntries(): Promise<Map<string, Buffer>> {
    const zipFS = new ZipFile(this._fileName);
    for (const entry of await zipFS.entries())
      this.entries.set(entry, await zipFS.read(entry));
    zipFS.close();
    return this.entries;
  }

  isLive() {
    return false;
  }

  traceURL() {
    return 'file://' + this._fileName;
  }

  async entryNames(): Promise<string[]> {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    return entry.toString();
  }

  async readBlob(entryName: string) {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    return entry as any;
  }
}
