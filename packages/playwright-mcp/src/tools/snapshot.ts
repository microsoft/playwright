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

import { waitForCompletion } from '../utils';

import type * as playwright from 'playwright';
import type { Tool, ToolContext, ToolResult } from './common';

const elementIdProperty = {
  elementId: {
    type: 'number',
    description: 'Target element',
  }
};

export const snapshot: Tool = {
  schema: {
    name: 'snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: {
      type: 'object',
      properties: {},
    }
  },

  handle: async context => {
    return await captureAriaSnapshot(context.page);
  }
};

export const navigate: Tool = {
  schema: {
    name: 'navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to',
        },
      },
    }
  },

  handle: async (context, params) => {
    return runAndCaptureSnapshot(context, () => context.page.goto(params!.url));
  }
};

export const click: Tool = {
  schema: {
    name: 'click',
    description: 'Perform click on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        ...elementIdProperty,
      },
      required: ['elementId'],
    }
  },

  handle: async (context, params) => {
    const locator = elementIdLocator(context.page, params!);
    return runAndCaptureSnapshot(context, () => locator.click());
  }
};

export const hover: Tool = {
  schema: {
    name: 'hover',
    description: 'Hover over element on page',
    inputSchema: {
      type: 'object',
      properties: {
        ...elementIdProperty,
      },
      required: ['elementId'],
    }
  },

  handle: async (context, params) => {
    const locator = elementIdLocator(context.page, params!);
    return runAndCaptureSnapshot(context, () => locator.hover());
  }
};

export const type: Tool = {
  schema: {
    name: 'type',
    description: 'Type text into editable element',
    inputSchema: {
      type: 'object',
      properties: {
        ...elementIdProperty,
        text: {
          type: 'string',
          description: 'Text to enter',
        },
        submit: {
          type: 'boolean',
          description: 'Whether to submit entered text (press Enter after)'
        }
      },
      required: ['elementId', 'text'],
    }
  },

  handle: async (context, params) => {
    const locator = elementIdLocator(context.page, params!);
    return await runAndCaptureSnapshot(context, async () => {
      locator.fill(params!.text as string);
      if (params!.submit)
        await locator.press('Enter');
    });
  }
};

function elementIdLocator(page: playwright.Page, params: Record<string, string>): playwright.Locator {
  return page.locator(`internal:aria-id=${params.elementId}`);
}

async function runAndCaptureSnapshot(context: ToolContext, callback: () => Promise<any>): Promise<ToolResult> {
  const page = context.page;
  await waitForCompletion(page, () => callback());
  return captureAriaSnapshot(page);
}

async function captureAriaSnapshot(page: playwright.Page): Promise<ToolResult> {
  const snapshot = await page.locator('html').ariaSnapshot({ _id: true } as any);
  return {
    content: [{ type: 'text', text: `# Current page snapshot\n${snapshot}` }],
  };
}
