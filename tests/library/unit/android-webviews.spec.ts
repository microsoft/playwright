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
import { server as coreServer } from '../../../packages/playwright-core/lib/coreBundle';

const WEBVIEW_PID = 3983;
const WEBVIEW_SOCKET = `webview_devtools_remote_${WEBVIEW_PID}`;

// `ps -A` on Android (toybox): USER PID PPID VSZ RSS WCHAN ADDR S NAME, ordered by pid ascending.
// Both extra rows contain the digits of WEBVIEW_PID and sort after it, so `grep 3983` returns them:
// systemui through its VSZ column, the kernel thread through its own pid.
const PS_TABLE = [
  'u0_a5013      3983   949 34184736 291360 0                  0 S com.example.webview',
  'u0_a91        4102   949 13983744 108820 0                  0 S com.android.systemui',
  'root         13983     2        0      0 0                  0 I [kworker/3:2-rcu_gp]',
];

const PROC_NET_UNIX = `0000000000000000: 00000002 00000000 00010000 0001 01 2989779 @${WEBVIEW_SOCKET}`;

function createBackend() {
  const deviceBackend = {
    serial: 'fake-serial',
    status: 'device',
    async init() { },
    async close() { },
    async open(): Promise<any> {
      throw new Error('not implemented');
    },
    async runCommand(command: string): Promise<Buffer> {
      if (command === 'shell:getprop ro.product.model')
        return Buffer.from('Fake Device');
      if (command === 'shell:cat /proc/net/unix | grep webview_devtools_remote')
        return Buffer.from(PROC_NET_UNIX);
      const grep = command.match(/^shell:ps -A \| grep (\d+)$/);
      if (grep)
        return Buffer.from(PS_TABLE.filter(line => line.includes(grep[1])).join('\n'));
      throw new Error(`Unexpected command: ${command}`);
    },
  };
  return { devices: async () => [deviceBackend] };
}

it('should attribute a webview socket to the process that owns it', async () => {
  const playwright = coreServer.createPlaywright({ sdkLanguage: 'javascript' });
  // Swap the adb backend for a scripted one - no device involved.
  (playwright.android as any)._backend = createBackend();

  const [device] = await playwright.android.devices(coreServer.nullProgress, {});
  try {
    expect(device.webViews()).toEqual([{
      pid: WEBVIEW_PID,
      pkg: 'com.example.webview',
      socketName: WEBVIEW_SOCKET,
    }]);
  } finally {
    await device.close(coreServer.nullProgress);
  }
});
