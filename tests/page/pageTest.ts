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

import type { Frame, Page, TestType, Locator } from '@playwright/test';
import type { PlatformWorkerFixtures } from '../config/platformFixtures';
import type { TestModeTestFixtures, TestModeWorkerFixtures, TestModeWorkerOptions } from '../config/testModeFixtures';
import { androidTest } from '../android/androidTest';
import { browserTest } from '../config/browserTest';
import { electronTest } from '../electron/electronTest';
import { webView2Test } from '../webview2/webView2Test';
import type { PageTestFixtures, PageWorkerFixtures } from './pageTestApi';
import type { ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';
import { expect as baseExpect } from '@playwright/test';

let impl: TestType<PageTestFixtures & ServerFixtures & TestModeTestFixtures, PageWorkerFixtures & PlatformWorkerFixtures & TestModeWorkerFixtures & TestModeWorkerOptions & ServerWorkerOptions> = browserTest;
export type BoundingBox = Awaited<ReturnType<Locator['boundingBox']>>;

if (process.env.PWPAGE_IMPL === 'android')
  impl = androidTest;
if (process.env.PWPAGE_IMPL === 'electron')
  impl = electronTest;
if (process.env.PWPAGE_IMPL === 'webview2')
  impl = webView2Test;

export const test = impl;

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

export const expect = baseExpect.extend({
  toContainYaml(received: string, expected: string) {
    const trimmed = expected.split('\n').filter(a => !!a.trim());
    const maxPrefixLength = Math.min(...trimmed.map(line => line.match(/^\s*/)[0].length));
    const trimmedExpected = trimmed.map(line => line.substring(maxPrefixLength)).join('\n');
    try {
      if (this.isNot)
        expect(received).not.toContain(trimmedExpected);
      else
        expect(received).toContain(trimmedExpected);
      return {
        pass: !this.isNot,
        message: () => '',
      };
    } catch (e) {
      return {
        pass: this.isNot,
        message: () => e.message,
      };
    }
  }
});
