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

import { z } from 'playwright-core/lib/mcpBundle';

import { defineTool } from './tool';

import type { ElectronContextFactory } from '../electronContextFactory';
import type { Context } from '../context';

// Helper to get electron factory from context, ensuring context is created
async function getElectronFactory(context: Context): Promise<ElectronContextFactory> {
  const factory = context.electronContextFactory();
  if (!factory)
    throw new Error('Electron tools are only available when running with --browser=electron');
  // Ensure the browser context is created (which launches the Electron app)
  await context.ensureBrowserContext();
  return factory;
}

const electronEvaluateSchema = z.object({
  function: z.string().describe('JavaScript function to execute in the Electron main process, e.g., "() => require(\'electron\').app.getPath(\'userData\')"'),
});

const electronEvaluate = defineTool({
  capability: 'electron',
  schema: {
    name: 'electron_evaluate',
    title: 'Evaluate in main process',
    description: 'Execute JavaScript in the Electron main process. This allows access to Electron APIs like app, BrowserWindow, ipcMain, etc.',
    inputSchema: electronEvaluateSchema,
    type: 'action',
  },

  handle: async (context, params, response) => {
    const factory = await getElectronFactory(context);
    try {
      const result = await factory.evaluateMain(params.function);
      response.addResult(JSON.stringify(result, null, 2) ?? 'undefined');
      response.addCode(`await electronApp.evaluate(${JSON.stringify(params.function)});`);
    } catch (error: any) {
      response.addError(`Error evaluating in main process: ${error.message}`);
    }
  },
});

const electronWindowsSchema = z.object({});

const electronWindows = defineTool({
  capability: 'electron',
  schema: {
    name: 'electron_windows',
    title: 'List Electron windows',
    description: 'List all open Electron BrowserWindows with their titles and URLs',
    inputSchema: electronWindowsSchema,
    type: 'readOnly',
  },

  handle: async (context, _params, response) => {
    const factory = await getElectronFactory(context);
    const windows = await factory.getWindows();

    const windowInfo = await Promise.all(windows.map(async (page, index) => ({
      index,
      title: await page.title(),
      url: page.url(),
    })));

    response.addResult(JSON.stringify({ windows: windowInfo }, null, 2));
    response.addCode('const windows = electronApp.windows();');
  },
});

const electronSelectWindowSchema = z.object({
  index: z.number().describe('Window index (0-based) to switch to'),
});

const electronSelectWindow = defineTool({
  capability: 'electron',
  schema: {
    name: 'electron_select_window',
    title: 'Select Electron window',
    description: 'Switch to a different Electron window by index. Use electron_windows to see available windows.',
    inputSchema: electronSelectWindowSchema,
    type: 'action',
  },

  handle: async (context, params, response) => {
    const factory = await getElectronFactory(context);
    const windows = await factory.getWindows();

    if (params.index < 0 || params.index >= windows.length)
      throw new Error(`Window index ${params.index} out of bounds (${windows.length} windows available)`);

    const page = windows[params.index];
    await page.bringToFront();

    // Update the current tab in context to point to this window
    await context.selectTab(params.index);

    response.addResult(`Switched to window ${params.index}: ${await page.title()}`);
    response.addCode(`const windows = electronApp.windows();\nawait windows[${params.index}].bringToFront();`);
  },
});

const electronAppInfoSchema = z.object({});

const electronAppInfo = defineTool({
  capability: 'electron',
  schema: {
    name: 'electron_app_info',
    title: 'Get Electron app info',
    description: 'Get information about the Electron application including name, version, and paths',
    inputSchema: electronAppInfoSchema,
    type: 'readOnly',
  },

  handle: async (context, _params, response) => {
    const factory = await getElectronFactory(context);

    const info = await factory.evaluateMain(`() => { const app = require('electron').app; return { name: app.getName(), version: app.getVersion(), isPackaged: app.isPackaged, paths: { userData: app.getPath('userData'), appData: app.getPath('appData'), temp: app.getPath('temp'), exe: app.getPath('exe'), appPath: app.getAppPath() } }; }`);

    response.addResult(JSON.stringify(info, null, 2));
    response.addCode(`const info = await electronApp.evaluate(() => ({
  name: require('electron').app.getName(),
  version: require('electron').app.getVersion(),
  // ...
}));`);
  },
});

const electronIpcSendSchema = z.object({
  channel: z.string().describe('IPC channel name to send the message on'),
  args: z.array(z.any()).optional().describe('Arguments to send with the message'),
});

const electronIpcSend = defineTool({
  capability: 'electron',
  schema: {
    name: 'electron_ipc_send',
    title: 'Send IPC message',
    description: 'Send an IPC message from the main process to the renderer process of the current window',
    inputSchema: electronIpcSendSchema,
    type: 'action',
  },

  handle: async (context, params, response) => {
    const factory = await getElectronFactory(context);
    const tab = context.currentTabOrDie();
    const page = tab.page;

    const browserWindow = await factory.getBrowserWindow(page);

    await browserWindow.evaluate((win: any, { channel, args }: { channel: string, args: any[] }) => {
      win.webContents.send(channel, ...args);
    }, { channel: params.channel, args: params.args ?? [] });

    response.addResult(`Sent IPC message on channel: ${params.channel}`);
    response.addCode(`const browserWindow = await electronApp.browserWindow(page);\nawait browserWindow.evaluate((win) => win.webContents.send('${params.channel}', ...args));`);
  },
});

export default [
  electronEvaluate,
  electronWindows,
  electronSelectWindow,
  electronAppInfo,
  electronIpcSend,
];
