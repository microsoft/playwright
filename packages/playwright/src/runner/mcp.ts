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

import path from 'path';
import { Writable } from 'stream';

import { mcp, z } from 'playwright-core/lib/utilsBundle';

import { TeleSuiteUpdater } from '../isomorphic/teleSuiteUpdater';
import { TestServerDispatcher } from './testServer';

const packageJSON = require('../../package.json');

const originalStdoutWrite = process.stdout.write;
const originalStdout = new Writable({
  write(chunk, encoding, callback) {
    originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
  },
});

export async function startMcpServer(dispatcher: TestServerDispatcher) {
  const server = new mcp.McpServer({
    name: 'Playwright Test',
    version: packageJSON.version,
  });

  const teleSuiteUpdater = new TeleSuiteUpdater({ pathSeparator: path.sep, onUpdate() {} });

  server.tool('listTests', 'List all tests', async () => {
    const { report } = await dispatcher.listTests({});
    teleSuiteUpdater.processListReport(report);
    const tests = teleSuiteUpdater.asModel().rootSuite.allTests().map(t => {
      return {
        id: t.id,
        title: t.titlePath().filter(p => p !== '').join(' >> '),
        location: t.location.file + ':' + t.location.line,
      };
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tests),
        }
      ]
    };
  });

  server.tool('runTests', 'Run tests', { ids: z.array(z.string()) }, async ({ ids }) => {
    const { status } = await dispatcher.runTests({ testIds: ids });
    return {
      content: [
        {
          type: 'text',
          text: `Status: ${status}`,
        }
      ]
    };
  });

  await server.connect(new mcp.StdioServerTransport(undefined, originalStdout));
}
