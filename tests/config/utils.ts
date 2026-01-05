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

import type { Locator, Frame, Page } from 'playwright-core';
import { ZipFile } from '../../packages/playwright-core/lib/server/utils/zipFile';
import type { StackFrame } from '../../packages/protocol/src/channels';
import { parseClientSideCallMetadata } from '../../packages/playwright-core/lib/utils/isomorphic/traceUtils';
import { TraceLoader } from '../../packages/playwright-core/src/utils/isomorphic/trace/traceLoader';
import { TraceModel } from '../../packages/playwright-core/src/utils/isomorphic/trace/traceModel';
import type { ActionTraceEvent, TraceEvent } from '@trace/trace';
import { renderTitleForCall } from '../../packages/playwright-core/lib/utils/isomorphic/protocolFormatter';
import { ZipTraceLoaderBackend } from '../../packages/playwright-core/lib/server/trace/viewer/traceParser';
import type { SnapshotStorage } from '../../packages/playwright-core/src/utils/isomorphic/trace/snapshotStorage';

export type BoundingBox = Awaited<ReturnType<Locator['boundingBox']>>;

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

export function expectedSSLError(browserName: string, platform: string, channel: string | undefined): RegExp {
  if (browserName === 'chromium')
    return /net::(ERR_CERT_AUTHORITY_INVALID|ERR_CERT_INVALID)/;
  if (browserName === 'webkit') {
    if (platform === 'darwin')
      return /The certificate for this server is invalid/;
    else if (platform === 'win32' && channel !== 'webkit-wsl')
      return /SSL peer certificate or SSH remote key was not OK/;
    else
      return /Unacceptable TLS certificate|Operation was cancelled/;
  }
  if (browserName === 'firefox' && isBidiChannel(channel))
    return /MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT/;
  return /SSL_ERROR_UNKNOWN/;
}

export function isBidiChannel(channel: string | undefined): boolean {
  return channel?.startsWith('bidi-chrom') || channel?.startsWith('moz-firefox') || false;
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
    actions: actionObjects.map(a => renderTitleForCall({ ...a, type: a.class })),
    actionObjects,
    stacks,
  };
}

export async function parseTrace(file: string): Promise<{ snapshots: SnapshotStorage, model: TraceModel }> {
  const backend = new ZipTraceLoaderBackend(file);
  const loader = new TraceLoader();
  await loader.load(backend, () => {});
  return { model: new TraceModel(file, loader.contextEntries), snapshots: loader.storage() };
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

export async function rafraf(target: Page | Frame, count = 1) {
  for (let i = 0; i < count; i++) {
    await target.evaluate(async () => {
      await new Promise(f => window.builtins.requestAnimationFrame(() => window.builtins.requestAnimationFrame(f)));
    });
  }
}

export function roundBox(box: BoundingBox): BoundingBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

export function unshift(snapshot: string): string {
  const lines = snapshot.split('\n');
  let whitespacePrefixLength = 100;
  for (const line of lines) {
    if (!line.trim())
      continue;
    const match = line.match(/^(\s*)/);
    if (match && match[1].length < whitespacePrefixLength)
      whitespacePrefixLength = match[1].length;
  }
  return lines.filter(t => t.trim()).map(line => line.substring(whitespacePrefixLength)).join('\n');
}

const ansiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAnsi(str: string): string {
  return str.replace(ansiRegex, '');
}
