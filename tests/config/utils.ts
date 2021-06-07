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

import { expect } from './test-runner';
import type { Frame, Page } from '../../index';

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