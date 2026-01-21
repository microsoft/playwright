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
import path from 'path';
import { chromium } from 'playwright';
import { Loop } from '@lowire/loop';

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TestServer } from '../config/testserver';
import { serverFixtures } from '../config/serverFixtures';
import { parseResponse } from '../../packages/playwright/lib/mcp/browser/response';

import type { Config } from '../../packages/playwright/src/mcp/config';
import type { BrowserContext } from 'playwright';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Stream } from 'stream';
import type { ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';

export { parseResponse };

export type TestOptions = {
  mcpArgs: string[] | undefined;
  mcpBrowser: string | undefined;
  mcpServerType: 'mcp' | 'test-mcp';
};

type CDPServer = {
  endpoint: string;
  start: () => Promise<BrowserContext>;
};

export type StartClient = (options?: {
  clientName?: string,
  args?: string[],
  omitArgs?: string[],
  cwd?: string,
  config?: Config,
  roots?: { name: string, uri: string }[],
  rootsResponseDelay?: number,
  env?: NodeJS.ProcessEnv,
  noTimeoutForTest?: boolean,
}) => Promise<{ client: Client, stderr: () => string }>;


type TestFixtures = {
  client: Client;
  startClient: StartClient;
  wsEndpoint: string;
  cdpServer: CDPServer;
  server: TestServer;
  httpsServer: TestServer;
  mcpHeadless: boolean;
  loop: Loop;
};

type WorkerFixtures = {
  _workerServers: { server: TestServer, httpsServer: TestServer };
};

export const serverTest = baseTest.extend<ServerFixtures, ServerWorkerOptions>(serverFixtures);

export const test = serverTest.extend<TestFixtures & TestOptions, WorkerFixtures>({
  mcpArgs: [undefined, { option: true }],

  client: async ({ startClient }, use) => {
    const { client } = await startClient();
    await use(client);
  },

  startClient: async ({ mcpHeadless, mcpBrowser, mcpArgs, mcpServerType }, use, testInfo) => {
    const configDir = path.dirname(test.info().config.configFile!);
    const clients: Client[] = [];

    await use(async options => {
      let args: string[] = mcpArgs ?? [];

      if (mcpHeadless)
        args.push('--headless');

      if (mcpServerType === 'test-mcp') {
        if (!options?.args?.some(arg => arg.startsWith('--config')))
          args.push(`--config=${test.info().outputPath()}`);
      } else {
        if (process.env.CI && process.platform === 'linux')
          args.push('--no-sandbox');
        if (mcpBrowser)
          args.push(`--browser=${mcpBrowser}`);
        if (options?.config) {
          const configFile = testInfo.outputPath('config.json');
          await fs.promises.writeFile(configFile, JSON.stringify(options.config, null, 2));
          args.push(`--config=${path.relative(configDir, configFile)}`);
        }
        if (!options?.noTimeoutForTest)
          args.push('--timeout-action=10000');
      }

      if (options?.args)
        args.push(...options.args);
      if (options?.omitArgs)
        args = args.filter(arg => !options.omitArgs?.includes(arg));

      const client = new Client({ name: options?.clientName ?? 'test', version: '1.0.0' }, options?.roots ? { capabilities: { roots: {} } } : undefined);
      if (options?.roots) {
        client.setRequestHandler(ListRootsRequestSchema, async request => {
          if (options.rootsResponseDelay)
            await new Promise(resolve => setTimeout(resolve, options.rootsResponseDelay));
          return {
            roots: options.roots,
          };
        });
      }
      const env = {
        ...process.env,
        PW_TMPDIR_FOR_TEST: testInfo.outputPath('tmp'),
        ...options?.env
      };
      const { transport, stderr } = await createTransport(mcpServerType, { args, env, cwd: options?.cwd || test.info().outputPath() });
      let stderrBuffer = '';
      stderr?.on('data', data => {
        if (process.env.PWDEBUGIMPL)
          process.stderr.write(data);
        stderrBuffer += data.toString();
      });
      clients.push(client);
      await client.connect(transport);
      await client.ping();
      return { client, stderr: () => stderrBuffer };
    });

    await Promise.all(clients.map(client => client.close()));
  },

  wsEndpoint: async ({ }, use) => {
    const browserServer = await chromium.launchServer();
    await use(browserServer.wsEndpoint());
    await browserServer.close();
  },

  cdpServer: async ({ mcpBrowser }, use, testInfo) => {
    test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser!), 'CDP is not supported for non-Chromium browsers');

    let browserContext: BrowserContext | undefined;
    const port = 9100 + testInfo.workerIndex;
    await use({
      endpoint: `http://localhost:${port}`,
      start: async () => {
        if (browserContext)
          throw new Error('CDP server already exists');
        browserContext = await chromium.launchPersistentContext(testInfo.outputPath('cdp-user-data-dir'), {
          channel: mcpBrowser,
          headless: true,
          args: [
            `--remote-debugging-port=${port}`,
          ],
        });
        return browserContext;
      }
    });
    await browserContext?.close();
  },

  mcpHeadless: async ({ headless }, use) => {
    await use(headless);
  },

  server: async ({ server }, use) => {
    server.setContent('/favicon.ico', '', 'image/x-icon');
    server.setContent('/', ``, 'text/html');
    server.setContent('/hello-world', `
      <title>Title</title>
      <body>Hello, world!</body>
    `, 'text/html');
    await use(server);
  },

  mcpBrowser: ['chrome', { option: true }],

  mcpServerType: ['mcp', { option: true }],
});

async function createTransport(mcpServerType: TestOptions['mcpServerType'], options: { args: string[], env: NodeJS.ProcessEnv, cwd: string }): Promise<{
  transport: Transport,
  stderr: Stream | null,
}> {
  const profilesDir = test.info().outputPath('ms-playwright');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [...(mcpServerType === 'test-mcp' ? testMcpServerPath : mcpServerPath), ...options.args],
    cwd: options.cwd,
    stderr: 'pipe',
    env: {
      ...options.env,
      DEBUG_COLORS: '0',
      DEBUG_HIDE_DATE: '1',
      PWMCP_PROFILES_DIR_FOR_TEST: profilesDir,
    },
  });
  return {
    transport,
    stderr: transport.stderr!,
  };
}

type Response = Awaited<ReturnType<Client['callTool']>>;

export const expect = baseExpect.extend({
  toHaveResponse(response: Response, object: any) {
    const parsed = parseResponse(response);
    const text = parsed.text;
    const isNot = this.isNot;

    const keys = Object.keys(object);
    for (const key of Object.keys(parsed)) {
      if (!keys.includes(key))
        delete parsed[key];
    }

    try {
      if (isNot) {
        expect(parsed).not.toEqual(expect.objectContaining(object));
      } else {
        expect(parsed).toEqual(expect.objectContaining(object));
        if (parsed.isError && !object.isError)
          throw new Error('Response is an error, but expected is not');
      }
    } catch (e) {
      return {
        pass: isNot,
        message: () => e.message + '\n\nResponse text:\n' + text,
      };
    }
    return {
      pass: !isNot,
      message: () => ``,
    };
  },

  toHaveTextResponse(response: Response, value: any) {
    const text = response.content[0].text
        .replace(/\[id=[^\]]+\]/g, '[id=<ID>]')
        .replace(/\([\d\.]+m?s\)/g, '(XXms)')
        .replace(/[✓] /g, 'ok');

    const isNot = this.isNot;
    try {
      if (isNot)
        expect(text).not.toEqual(value);
      else
        expect(text).toEqual(value);
    } catch (e) {
      return {
        pass: isNot,
        message: () => e.message,
      };
    }
    return {
      pass: !isNot,
      message: () => ``,
    };
  },
});

export function formatOutput(output: string): string[] {
  return output.split('\n').map(line => line.replace(/^pw:mcp:test /, '').replace(/user data dir.*/, 'user data dir').trim()).filter(Boolean);
}

export const mcpServerPath = [path.join(__dirname, '../../packages/playwright/cli.js'), 'run-mcp-server'];
export const testMcpServerPath = [path.join(__dirname, '../../packages/playwright-test/cli.js'), 'run-test-mcp-server'];

type Files = { [key: string]: string | Buffer };

export async function writeFiles(files: Files, options?: { update?: boolean }) {
  const baseDir = test.info().outputPath();

  if (!options?.update && !Object.keys(files).some(name => name.includes('package.json'))) {
    files = {
      ...files,
      'package.json': `{ "name": "test-project" }`,
    };
  }

  if (!options?.update && !Object.keys(files).some(name => name.includes('tsconfig.json') || name.includes('jsconfig.json'))) {
    files = {
      ...files,
      'tsconfig.json': `{}`,
    };
  }

  await Promise.all(Object.keys(files).map(async name => {
    const fullName = path.join(baseDir, name);
    if (files[name] === undefined)
      return;
    await fs.promises.mkdir(path.dirname(fullName), { recursive: true });
    await fs.promises.writeFile(fullName, files[name]);
  }));

  return baseDir;
}

export async function prepareDebugTest(startClient: StartClient, testFile?: string, clientArgs?: Parameters<StartClient>[0]) {
  await writeFiles({
    'a.test.ts': testFile || `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
    `
  });

  const { client } = await startClient(clientArgs);
  const listResult = await client.callTool({
    name: 'test_list',
  });
  const [, id] = listResult.content[0].text.match(/\[id=([^\]]+)\]/);
  return { client, id };
}
