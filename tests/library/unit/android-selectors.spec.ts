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
        return Buffer.from('');
      throw new Error(`Unexpected command: ${command}`);
    },
  };
  return { devices: async () => [deviceBackend] };
}

it('AN-002 should translate nested selectors for the Android driver', async () => {
  const playwright = coreServer.createPlaywright({ sdkLanguage: 'javascript' });
  (playwright.android as any)._backend = createBackend();

  const [device] = await playwright.android.devices(coreServer.nullProgress, {});
  const messages: any[] = [];
  (device as any)._driver = async () => ({
    send(message: string) {
      const request = JSON.parse(message);
      messages.push(request);
      const callback = (device as any)._callbacks.get(request.id);
      callback.fulfill({});
      (device as any)._callbacks.delete(request.id);
    },
  });

  try {
    await device.send(coreServer.nullProgress, 'info', {
      androidSelector: {
        clazz: '^android\\.webkit\\.WebView$',
        hasChild: {
          androidSelector: { text: '^Submit$' },
        },
      },
    });
    await device.send(coreServer.nullProgress, 'click', {
      selector: {
        hasDescendant: {
          androidSelector: {
            hasChild: {
              androidSelector: { text: '^Submit$' },
            },
          },
          maxDepth: 20,
        },
      },
    });

    expect(messages.map(({ id, ...message }) => message)).toEqual([
      {
        method: 'info',
        params: {
          selector: {
            clazz: '^android\\.webkit\\.WebView$',
            hasChild: {
              selector: { text: '^Submit$' },
            },
          },
          timeout: 0,
        },
      },
      {
        method: 'click',
        params: {
          selector: {
            hasDescendant: {
              selector: {
                hasChild: {
                  selector: { text: '^Submit$' },
                },
              },
              maxDepth: 20,
            },
            maxDepth: 20,
          },
          timeout: 0,
        },
      },
    ]);
  } finally {
    await device.close(coreServer.nullProgress);
  }
});
