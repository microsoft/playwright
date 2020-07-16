/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
import expect from 'expect';
import {Page, selectors, Frame} from 'playwright';
import os from 'os';
import {promisify} from 'util';
import fs from 'fs';
import rimraf from 'rimraf';
import path from 'path';
import {BROWSER} from 'playwright-runner';
import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';
import pixelmatch from 'pixelmatch';

const mkdtempAsync = promisify(fs.mkdtemp);
const removeFolderAsync: (path: string) => Promise<void> = promisify(rimraf);

export async function verifyViewport(page: Page, width: number, height: number) {
  expect(page.viewportSize().width).toBe(width);
  expect(page.viewportSize().height).toBe(height);
  expect(await page.evaluate('window.innerWidth')).toBe(width);
  expect(await page.evaluate('window.innerHeight')).toBe(height);
}

export async function attachFrame(page: Page, frameId: string, url: string) {
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
export function dumpFrames(frame: Frame, indentation: string) {
  indentation = indentation || '';
  let description = frame.url().replace(/:\d{4}\d?\//, ':<PORT>/');
  if (frame.name())
    description += ' (' + frame.name() + ')';
  const result = [indentation + description];
  const childFrames = frame.childFrames();
  childFrames.sort((a, b) => {
    if (a.url() !== b.url())
      return a.url() < b.url() ? -1 : 1;
    return a.name() < b.name() ? -1 : 1;
  });
  for (const child of childFrames)
    result.push(...dumpFrames(child, '    ' + indentation));
  return result;
}

export async function makeUserDataDir() {
  return await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_profile-'));
}

export async function removeUserDataDir(dir) {
  await removeFolderAsync(dir).catch(e => {});
}

export const registerEngine: typeof selectors.register = async function(name, script, options) {
  try {
    await selectors.register(name, script, options);
  } catch (e) {
    if (!e.message.includes('has been already registered'))
      throw e;
  }
};

export function golden(name: string) {
  const golden = path.join(__dirname, 'golden-' + BROWSER);
  return name ? path.join(golden, name) : golden;
}
export function output(name?: string) {
  const output = path.join(__dirname, 'output-' + BROWSER);
  return name ? path.join(output, name) : output;
}

export const WIN = os.platform() === 'win32';
export const LINUX = os.platform() === 'linux';
export const MAC = os.platform() === 'darwin';
export const USES_HOOKS = !!process.env.PWCHANNEL;
export const CHANNEL = !!process.env.PWCHANNEL;

expect.extend({
  toMatchGolden(this: {isNot: boolean}, actualBuffer: Buffer, name: string) {
    const {isNot} = this;
    if (isNot)
      throw new Error(`Cannot use 'not' with toMatchSnapshot`);
    const filePath = golden(name);
    const exists = fs.existsSync(filePath);
    if (!exists) {
      fs.mkdirSync(path.dirname(filePath), {recursive: true});
      fs.writeFileSync(filePath, actualBuffer);
      return {
        pass: true,
      };
    }
    const expectedBuffer = fs.readFileSync(filePath);

    if (!actualBuffer || !(actualBuffer instanceof Buffer))
      return { errorMessage: 'Actual result should be Buffer.' };

    const mimeType = name.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png';

    const actual = mimeType === 'image/png' ? (PNG as any).sync.read(actualBuffer) : jpeg.decode(actualBuffer);
    const expected = mimeType === 'image/png' ? (PNG as any).sync.read(expectedBuffer) : jpeg.decode(expectedBuffer);
    if (expected.width !== actual.width || expected.height !== actual.height) {
      return {
        pass: false,
        message: `Sizes differ; expected image ${expected.width}px X ${expected.height}px, but got ${actual.width}px X ${actual.height}px. `
      };
    }
    const diff = new PNG({width: expected.width, height: expected.height});
    const count = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {threshold: 0.2});
    if (count === 0) {
      return {
        pass: true,
        mesage: () => ''
      };
    }
    fs.mkdirSync(output(), {recursive: true});
    fs.writeFileSync(output('diff-' + name), (PNG as any).sync.write(diff));
    fs.writeFileSync(output('expected-' + name), expectedBuffer);
    fs.writeFileSync(output('actual-' + name), actualBuffer);
    return {
      pass: false,
      message: () => `Images do not match. Output written to ${output('')}`
    };
  }
});
