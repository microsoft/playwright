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
import { defineTabTool } from './tool';

const localStorageList = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_localstorage_list',
    title: 'List localStorage',
    description: 'List all localStorage key-value pairs',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const items = await tab.page.evaluate(() => {
      const result: { key: string; value: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null)
          result.push({ key, value: localStorage.getItem(key) || '' });
      }
      return result;
    });

    if (items.length === 0)
      response.addTextResult('No localStorage items found');
    else
      response.addTextResult(items.map(item => `${item.key}=${item.value}`).join('\n'));
    response.addCode(`await page.evaluate(() => ({ ...localStorage }));`);
  },
});

const localStorageGet = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_localstorage_get',
    title: 'Get localStorage item',
    description: 'Get a localStorage item by key',
    inputSchema: z.object({
      key: z.string().describe('Key to get'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const value = await tab.page.evaluate(key => localStorage.getItem(key), params.key);

    if (value === null)
      response.addTextResult(`localStorage key '${params.key}' not found`);
    else
      response.addTextResult(`${params.key}=${value}`);
    response.addCode(`await page.evaluate(() => localStorage.getItem('${params.key}'));`);
  },
});

const localStorageSet = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_localstorage_set',
    title: 'Set localStorage item',
    description: 'Set a localStorage item',
    inputSchema: z.object({
      key: z.string().describe('Key to set'),
      value: z.string().describe('Value to set'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.evaluate(({ key, value }) => localStorage.setItem(key, value), params);
    response.addCode(`await page.evaluate(() => localStorage.setItem('${params.key}', '${params.value}'));`);
  },
});

const localStorageDelete = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_localstorage_delete',
    title: 'Delete localStorage item',
    description: 'Delete a localStorage item',
    inputSchema: z.object({
      key: z.string().describe('Key to delete'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.evaluate(key => localStorage.removeItem(key), params.key);
    response.addCode(`await page.evaluate(() => localStorage.removeItem('${params.key}'));`);
  },
});

const localStorageClear = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_localstorage_clear',
    title: 'Clear localStorage',
    description: 'Clear all localStorage',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.evaluate(() => localStorage.clear());
    response.addCode(`await page.evaluate(() => localStorage.clear());`);
  },
});

// SessionStorage

const sessionStorageList = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_sessionstorage_list',
    title: 'List sessionStorage',
    description: 'List all sessionStorage key-value pairs',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const items = await tab.page.evaluate(() => {
      const result: { key: string; value: string }[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key !== null)
          result.push({ key, value: sessionStorage.getItem(key) || '' });
      }
      return result;
    });

    if (items.length === 0)
      response.addTextResult('No sessionStorage items found');
    else
      response.addTextResult(items.map(item => `${item.key}=${item.value}`).join('\n'));
    response.addCode(`await page.evaluate(() => ({ ...sessionStorage }));`);
  },
});

const sessionStorageGet = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_sessionstorage_get',
    title: 'Get sessionStorage item',
    description: 'Get a sessionStorage item by key',
    inputSchema: z.object({
      key: z.string().describe('Key to get'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const value = await tab.page.evaluate(key => sessionStorage.getItem(key), params.key);

    if (value === null)
      response.addTextResult(`sessionStorage key '${params.key}' not found`);
    else
      response.addTextResult(`${params.key}=${value}`);
    response.addCode(`await page.evaluate(() => sessionStorage.getItem('${params.key}'));`);
  },
});

const sessionStorageSet = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_sessionstorage_set',
    title: 'Set sessionStorage item',
    description: 'Set a sessionStorage item',
    inputSchema: z.object({
      key: z.string().describe('Key to set'),
      value: z.string().describe('Value to set'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), params);
    response.addCode(`await page.evaluate(() => sessionStorage.setItem('${params.key}', '${params.value}'));`);
  },
});

const sessionStorageDelete = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_sessionstorage_delete',
    title: 'Delete sessionStorage item',
    description: 'Delete a sessionStorage item',
    inputSchema: z.object({
      key: z.string().describe('Key to delete'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.evaluate(key => sessionStorage.removeItem(key), params.key);
    response.addCode(`await page.evaluate(() => sessionStorage.removeItem('${params.key}'));`);
  },
});

const sessionStorageClear = defineTabTool({
  capability: 'storage',

  schema: {
    name: 'browser_sessionstorage_clear',
    title: 'Clear sessionStorage',
    description: 'Clear all sessionStorage',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.evaluate(() => sessionStorage.clear());
    response.addCode(`await page.evaluate(() => sessionStorage.clear());`);
  },
});

export default [
  localStorageList,
  localStorageGet,
  localStorageSet,
  localStorageDelete,
  localStorageClear,
  sessionStorageList,
  sessionStorageGet,
  sessionStorageSet,
  sessionStorageDelete,
  sessionStorageClear,
];
