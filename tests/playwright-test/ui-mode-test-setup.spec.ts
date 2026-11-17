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

import { test, expect, retries, dumpTestTree } from './ui-mode-fixtures';
import fs from 'fs';
import path from 'path';

test.describe.configure({ mode: 'parallel', retries });

test('should run global setup and teardown', async ({ runUITest }, testInfo) => {
  const { page, testProcess } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'globalSetup.ts': `
      import { basename } from "node:path";
      export default (config) => {
        console.log('\\n%%from-global-setup');
        console.log("setupOutputDir: " + basename(config.projects[0].outputDir));
      };
    `,
    'globalTeardown.ts': `
      export default (config) => {
        console.log('\\n%%from-global-teardown');
        console.log('%%' + JSON.stringify(config));
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  }, undefined, { additionalArgs: ['--output=foo'] });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 (100%) — 1 passed');

  await page.getByTitle('Toggle output').click();
  const output = page.getByTestId('output');
  await expect(output).toContainText('from-global-setup');
  await expect(output).toContainText('setupOutputDir: foo');
  await page.close();

  await expect.poll(() => testProcess.outputLines()).toContain('from-global-teardown');

  const teardownConfig = JSON.parse(testProcess.outputLines()[1]);
  expect(teardownConfig.projects[0].outputDir).toEqual(testInfo.outputPath('foo'));
});

test('should teardown on sigint', async ({ runUITest, nodeVersion }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
  test.skip(nodeVersion.major < 18);

  const { page, testProcess } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'globalSetup.ts': `
      export default () => console.log('\\n%%from-global-setup');
    `,
    'globalTeardown.ts': `
      export default () => console.log('\\n%%from-global-teardown');
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 (100%) — 1 passed');
  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText('from-global-setup');

  testProcess.process.kill('SIGINT');
  await expect.poll(() => testProcess.outputLines()).toEqual([
    'from-global-teardown',
  ]);
});

const testsWithSetup = {
  'playwright.config.ts': `
    import { defineConfig } from '@playwright/test';
    export default defineConfig({
      projects: [
        { name: 'setup', teardown: 'teardown', testMatch: 'setup.ts' },
        { name: 'test', testMatch: 'test.ts', dependencies: ['setup'] },
        { name: 'teardown', testMatch: 'teardown.ts' },
      ]
    });
  `,
  'setup.ts': `
    import { test, expect } from '@playwright/test';
    test('setup', async ({}) => {
      console.log('from-setup');
    });
  `,
  'test.ts': `
    import { test, expect } from '@playwright/test';
    test('test', async ({}) => {
      console.log('from-test');
    });
  `,
  'teardown.ts': `
    import { test, expect } from '@playwright/test';
    test('teardown', async ({}) => {
      console.log('from-teardown');
    });
  `,
};

test('should run setup and teardown projects (1)', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByRole('checkbox', { name: 'setup' }).setChecked(false);
  await page.getByRole('checkbox', { name: 'teardown' }).setChecked(false);
  await page.getByRole('checkbox', { name: 'test' }).setChecked(false);

  await expect(page.getByTestId('project-filters')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - checkbox "setup"
      - listitem:
        - checkbox "test"
      - listitem:
        - checkbox "teardown"
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ setup.ts
        ✅ setup
    ▼ ✅ teardown.ts
        ✅ teardown
    ▼ ✅ test.ts
        ✅ test
  `);

  await expect(page).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] setup.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] setup/}
      - treeitem "[icon-check] teardown.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] teardown/}
      - treeitem "[icon-check] test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] test/}
  `);

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`from-setup`);
  await expect(page.getByTestId('output')).toContainText(`from-test`);
  await expect(page.getByTestId('output')).toContainText(`from-teardown`);

  await expect(page.getByTestId('output')).toMatchAriaSnapshot(`
    - textbox "Terminal input"
  `);
});

test('should run setup and teardown projects (2)', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByRole('checkbox', { name: 'setup' }).setChecked(false);
  await page.getByRole('checkbox', { name: 'teardown' }).setChecked(true);
  await page.getByRole('checkbox', { name: 'test' }).setChecked(true);

  await expect(page.getByTestId('project-filters')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - checkbox "setup"
      - listitem:
        - checkbox "test" [checked]
      - listitem:
        - checkbox "teardown" [checked]
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ teardown.ts
        ✅ teardown
    ▼ ✅ test.ts
        ✅ test
  `);

  await expect(page).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] teardown.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] teardown/}
      - treeitem "[icon-check] test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] test/}
  `);

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`from-test`);
  await expect(page.getByTestId('output')).toContainText(`from-teardown`);
  await expect(page.getByTestId('output')).not.toContainText(`from-setup`);

  await expect(page.getByTestId('output')).toMatchAriaSnapshot(`
    - textbox "Terminal input"
  `);
});

test('should run setup and teardown projects (3)', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByRole('checkbox', { name: 'setup' }).setChecked(false);
  await page.getByRole('checkbox', { name: 'teardown' }).setChecked(false);
  await page.getByRole('checkbox', { name: 'test' }).setChecked(true);

  await expect(page.getByTestId('project-filters')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - checkbox "setup"
      - listitem:
        - checkbox "test" [checked]
      - listitem:
        - checkbox "teardown"
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ test.ts
        ✅ test
  `);

  await expect(page).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] test/}
  `);

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`from-test`);
  await expect(page.getByTestId('output')).not.toContainText(`from-setup`);
  await expect(page.getByTestId('output')).not.toContainText(`from-teardown`);

  await expect(page.getByTestId('output')).toMatchAriaSnapshot(`
    - textbox "Terminal input"
  `);
});

test('should run part of the setup only', async ({ runUITest }) => {
  const { page } = await runUITest(testsWithSetup);
  await page.getByText('Status:').click();
  await page.getByRole('checkbox', { name: 'setup' }).setChecked(true);
  await page.getByRole('checkbox', { name: 'teardown' }).setChecked(true);
  await page.getByRole('checkbox', { name: 'test' }).setChecked(true);

  await expect(page.getByTestId('project-filters')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - checkbox "setup" [checked]
      - listitem:
        - checkbox "test" [checked]
      - listitem:
        - checkbox "teardown" [checked]
  `);

  await page.getByText('setup.ts').hover();
  await page.getByRole('treeitem', { name: 'setup.ts' }).getByRole('button', { name: 'Run' }).click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ setup.ts <=
        ✅ setup
    ▼ ✅ teardown.ts
        ✅ teardown
    ▼ ◯ test.ts
        ◯ test
  `);

  await expect(page).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] setup.ts" [expanded] [selected]:
        - button "Run"
        - button "Show source"
        - button "Watch"
        - group:
          - treeitem ${/\[icon-check\] setup/}
      - treeitem "[icon-check] teardown.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] teardown/}
      - treeitem "[icon-circle-outline] test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-outline] test"
  `);
});

for (const useWeb of [true, false]) {
  test.describe(`web-mode: ${useWeb}`, () => {
    test('should run teardown with SIGINT', async ({ runUITest, nodeVersion }) => {
      test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
      test.skip(nodeVersion.major < 18);
      const { page, testProcess } = await runUITest({
        'playwright.config.ts': `
          import { defineConfig } from '@playwright/test';
          export default defineConfig({
            globalTeardown: './globalTeardown.ts',
          });
        `,
        'globalTeardown.ts': `
          export default async () => {
            console.log('\\n%%from-global-teardown0000')
            await new Promise(f => setTimeout(f, 3000));
            console.log('\\n%%from-global-teardown3000')
          };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('should work', async ({}) => {});
        `
      }, null, { useWeb });
      await page.getByTitle('Run all').click();
      await expect(page.getByTestId('status-line')).toHaveText('1/1 (100%) — 1 passed');
      await testProcess.kill('SIGINT');
      await expect.poll(() => testProcess.outputLines()).toEqual([
        'from-global-teardown0000',
        'from-global-teardown3000',
      ]);
    });

    test('should serve UI mode under a random path', async ({ runUITest }) => {
      const { page } = await runUITest({
        'a.test.js': `
          import { test } from '@playwright/test';
          test('should work', async ({}) => {});
        `
      }, undefined, { useWeb });
      await expect(page.getByTitle('Run all')).toBeVisible();
      const url = new URL(page.url());
      const prefix = url.pathname.split('/')[1];
      expect(prefix).toMatch(/^[0-9a-f]{32}$/);
      const root = await fetch(url.origin + '/', { redirect: 'manual' });
      expect(root.status).toBe(useWeb ? 302 : 404);
      if (useWeb)
        expect(root.headers.get('location')).toBe(`./${prefix}/trace/uiMode.html${url.search}`);
      expect((await fetch(url.origin + '/trace/file?path=' + encodeURIComponent(test.info().outputPath('a.test.js')))).status).toBe(404);
      expect((await fetch(`${url.origin}/${prefix}/trace/uiMode.html`)).status).toBe(200);
    });
  });
}

test('should not let the page load modules or open project files as pages', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.js': `
      import { test } from '@playwright/test';
      test('should work', async ({}) => {});
    `,
    'module.js': `
      require('fs').writeFileSync(require('path').join(__dirname, 'loaded.txt'), '');
      module.exports = class { onBegin() {} };
    `,
  }, undefined, { additionalArgs: ['--reporter=line'] });

  // The reporter from the command line still works.
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 (100%) — 1 passed');

  const modulePath = test.info().outputPath('module.js');
  const result = await page.evaluate(async modulePath => {
    const fileUrl = 'file?path=' + encodeURIComponent(modulePath);
    const fileResponse = await fetch(fileUrl);
    const iframe = document.createElement('iframe');
    iframe.src = fileUrl;
    document.body.appendChild(iframe);
    await new Promise(f => iframe.onload = f);
    const framedFile = !!iframe.contentDocument?.body.innerText;

    // A sandboxed page has the "null" origin.
    const wsURL = new URL('../ws', location.href).toString().replace('http', 'ws');
    const sandboxed = document.createElement('iframe');
    sandboxed.setAttribute('sandbox', 'allow-scripts');
    sandboxed.srcdoc = `<script>
      const ws = new WebSocket(${JSON.stringify(wsURL)});
      ws.onopen = () => parent.postMessage('open', '*');
      ws.onerror = () => parent.postMessage('error', '*');
    </` + `script>`;
    const sandboxedWebSocket = new Promise(f => window.addEventListener('message', event => f(event.data), { once: true }));
    document.body.appendChild(sandboxed);

    const ws = new WebSocket(wsURL);
    await new Promise(f => ws.onopen = f);
    const send = (id: number, method: string, params: any) => new Promise(f => {
      ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id === id)
          f(message.error);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const errors = [
      await send(1, 'initialize', { serializer: modulePath }),
      await send(2, 'runTests', { reporters: [modulePath] }),
      await send(3, '_wireReporter', {}),
    ];
    ws.close();
    return { csp: fileResponse.headers.get('content-security-policy'), framedFile, sandboxedWebSocket: await sandboxedWebSocket, errors };
  }, modulePath);
  expect(result).toEqual({
    csp: 'sandbox',
    framedFile: false,
    sandboxedWebSocket: 'error',
    errors: [
      'Error: UI mode does not accept a serializer',
      'Error: UI mode only accepts the reporters from the command line',
      'Error: Unknown method: _wireReporter',
    ],
  });
  expect(fs.existsSync(test.info().outputPath('loaded.txt'))).toBe(false);
});

test('should restart webserver on reload', async ({ runUITest }) => {
  const SIMPLE_SERVER_PATH = path.join(__dirname, 'assets', 'simple-server.js');
  const port = test.info().workerIndex * 2 + 10500;

  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
          reuseExistingServer: false,
        },
      });
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({ page }) => {
        await page.goto('http://localhost:${port}/hello');
      });
    `
  }, { DEBUG: 'pw:webserver' });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 (100%) — 1 passed');

  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText('[WebServer] listening');

  await page.getByTitle('Clear output').click();
  await expect(page.getByTestId('output')).not.toContainText('[WebServer] listening');

  await page.getByTitle('Reload').click();
  await expect(page.getByTestId('output')).toContainText('[WebServer] listening');
  await expect(page.getByTestId('output')).not.toContainText('set reuseExistingServer:true');

  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 (100%) — 1 passed');
});
