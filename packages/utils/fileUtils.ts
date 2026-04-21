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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { calculateSha1 } from './crypto';

export const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export async function mkdirIfNeeded(filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
}

export async function removeFolders(dirs: string[]): Promise<(Error| undefined)[]> {
  return await Promise.all(dirs.map((dir: string) =>
    fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 10 }).catch(e => e)
  ));
}

export function canAccessFile(file: string) {
  if (!file)
    return false;

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

export async function copyFileAndMakeWritable(from: string, to: string) {
  await fs.promises.copyFile(from, to);
  await fs.promises.chmod(to, 0o664);
}

export function addSuffixToFilePath(filePath: string, suffix: string): string {
  const ext = path.extname(filePath);
  const base = filePath.substring(0, filePath.length - ext.length);
  return base + suffix + ext;
}

export function sanitizeForFilePath(s: string) {
  return s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}

export function toPosixPath(aPath: string): string {
  return aPath.split(path.sep).join(path.posix.sep);
}

export function makeSocketPath(domain: string, name: string): string {
  const userNameHash = calculateSha1(process.env.USERNAME || process.env.USER || 'default').slice(0, 8);
  if (process.platform === 'win32') {
    const socketsDir = process.env.PLAYWRIGHT_SOCKETS_DIR;
    const suffix = socketsDir ? `-${calculateSha1(socketsDir).slice(0, 8)}` : '';
    return `\\\\.\\pipe\\pw-${userNameHash}-${domain}-${name}${suffix}`;
  }
  const baseDir = process.env.PLAYWRIGHT_SOCKETS_DIR || path.join(os.tmpdir(), `pw-${userNameHash}`);
  const dir = path.join(baseDir, domain);
  const result = path.join(dir, `${name}.sock`);
  fs.mkdirSync(dir, { recursive: true });
  return result;
}
