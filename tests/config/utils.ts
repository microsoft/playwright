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
import type { StackFrame } from '@protocol/channels';
import { parseClientSideCallMetadata } from '../../packages/trace/src/traceUtils';

export async function attachFrame(page: Page, frameId: string, url: string): Promise<Frame> {
  const handle = await page.evaluateHandle(async ({ frameId, url }) => {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.id = frameId;
    document.body.appendChild(frame);
    await new Promise(x => frame.onload = x);
    return frame;
  }, { frameId, url });
  return handle.asElement().contentFrame();
}

export async function detachFrame(page: Page, frameId: string) {
  await page.evaluate(frameId => {
    document.getElementById(frameId).remove();
  }, frameId);
}

export async function verifyViewport(page: Page, width: number, height: number) {
  // `expect` may clash in test runner tests if imported eagerly.
  const { expect } = require('@playwright/test');
  expect(page.viewportSize().width).toBe(width);
  expect(page.viewportSize().height).toBe(height);
  expect(await page.evaluate('window.innerWidth')).toBe(width);
  expect(await page.evaluate('window.innerHeight')).toBe(height);
}

export function expectedSSLError(browserName: string): string {
  let expectedSSLError: string;
  if (browserName === 'chromium') {
    expectedSSLError = 'net::ERR_CERT_AUTHORITY_INVALID';
  } else if (browserName === 'webkit') {
    if (process.platform === 'darwin')
      expectedSSLError = 'The certificate for this server is invalid';
    else if (process.platform === 'win32')
      expectedSSLError = 'SSL peer certificate or SSH remote key was not OK';
    else
      expectedSSLError = 'Unacceptable TLS certificate';
  } else {
    expectedSSLError = 'SSL_ERROR_UNKNOWN';
  }
  return expectedSSLError;
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
  // Supress one-time warning:
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

export async function parseTrace(file: string): Promise<{ events: any[], resources: Map<string, Buffer>, actions: string[], stacks: Map<string, StackFrame[]> }> {
  const zipFS = new ZipFile(file);
  const resources = new Map<string, Buffer>();
  for (const entry of await zipFS.entries())
    resources.set(entry, await zipFS.read(entry));
  zipFS.close();

  const events = [];
  for (const line of resources.get('trace.trace').toString().split('\n')) {
    if (line)
      events.push(JSON.parse(line));
  }

  for (const line of resources.get('trace.network').toString().split('\n')) {
    if (line)
      events.push(JSON.parse(line));
  }

  const stacks = parseClientSideCallMetadata(JSON.parse(resources.get('trace.stacks').toString()));
  return {
    events,
    resources,
    actions: eventsToActions(events),
    stacks,
  };
}

function eventsToActions(events: any[]): string[] {
  // Trace viewer only shows non-internal non-tracing actions.
  return events.filter(e => e.type === 'action' && !e.metadata.internal && !e.metadata.method.startsWith('tracing'))
      .sort((a, b) => a.metadata.startTime - b.metadata.startTime)
      .map(e => e.metadata.apiName);
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
