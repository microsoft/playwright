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

import { test as it, expect } from '@playwright/test';
import fs from 'fs';
import net from 'net';
import { makeSocketPath } from '../../../packages/utils/fileUtils';

it.describe('makeSocketPath', () => {
  it.skip(process.platform === 'win32', 'Windows named pipes are not constrained by sockaddr_un.sun_path');

  it('should keep a long socket name within the OS path length limit', () => {
    const socketPath = makeSocketPath('cli', 'session-' + 'a'.repeat(200));
    // sockaddr_un.sun_path holds 104 bytes on macOS/BSD and 108 on Linux.
    const limit = process.platform === 'linux' ? 107 : 103;
    expect(Buffer.byteLength(socketPath)).toBeLessThanOrEqual(limit);
    expect(socketPath.endsWith('.sock')).toBe(true);
  });

  it('should produce a listenable socket path for a long name', async () => {
    const socketPath = makeSocketPath('cli', 'listen-' + 'b'.repeat(200));
    const server = net.createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', reject);
        server.listen(socketPath, resolve);
      });
      // The socket must exist at exactly the returned path; a path over the
      // limit would silently bind to a truncated one and break clients.
      expect(fs.existsSync(socketPath)).toBe(true);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      fs.rmSync(socketPath, { force: true });
    }
  });

  it('should keep short socket names human-readable', () => {
    expect(makeSocketPath('cli', 'default').endsWith('default.sock')).toBe(true);
  });
});
