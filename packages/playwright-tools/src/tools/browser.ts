/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type playwright from 'playwright';
import type { JSONSchemaType, ToolDeclaration } from '../../types';
import type { ToolResult } from '../../browser';
import { waitForNetwork } from './utils';

type LocatorEx = playwright.Locator & {
  _generateLocatorString: () => Promise<string>;
};

const intentProperty = {
  intent: {
    type: 'string',
    description: 'Intent behind this particular action. Used as a comment.',
  }
};

const elementIdProperty = {
  elementId: {
    type: 'number',
    description: 'Target element',
  }
};

export const schema: ToolDeclaration[] = [
  {
    name: 'navigate',
    description: 'Navigate to a URL',
    parameters: {
      type: 'object',
      properties: {
        ...intentProperty,
        url: {
          type: 'string',
          description: 'URL to navigate to',
        },
      },
      required: ['intent', 'elementId'],
    }
  },
  {
    name: 'click',
    description: 'Perform click on a web page',
    parameters: {
      type: 'object',
      properties: {
        ...intentProperty,
        ...elementIdProperty,
      },
      required: ['intent', 'elementId'],
    }
  },
  {
    name: 'enterText',
    description: 'Enter text into editable element',
    parameters: {
      type: 'object',
      properties: {
        ...intentProperty,
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
      required: ['intent', 'elementId', 'text'],
    }
  },
  {
    name: 'wait',
    description: `Wait for given amount of time to see if the page updates. Use it after action if you think page is not ready yet`,
    parameters: {
      type: 'object',
      properties: {
        ...intentProperty,
        time: {
          type: 'integer',
          description: 'Time to wait in seconds',
        },
      },
      required: ['intent', 'time'],
    }
  },
];

export async function call(page: playwright.Page, toolName: string, params: Record<string, JSONSchemaType>): Promise<ToolResult> {
  const code: string[] = [];
  try {
    await waitForNetwork(page, async () => {
      await performAction(page, toolName, params, code);
    });
  } catch (e) {
    return { error: e.message, snapshot: await snapshot(page), code };
  }
  return { snapshot: await snapshot(page), code };
}

export async function snapshot(page: playwright.Page) {
  const params = { _id: true } as any;
  return `<Page snapshot>\n${await page.locator('body').ariaSnapshot(params)}\n</Page snapshot>`;
}

async function performAction(page: playwright.Page, toolName: string, params: Record<string, JSONSchemaType>, code: string[]) {
  const locator = elementLocator(page, params);
  code.push((params.intent as string).split('\n').map(line => `// ${line}`).join('\n'));
  if (toolName === 'navigate') {
    code.push(`await page.goto(${JSON.stringify(params.url)})`);
    await page.goto(params.url as string);
  } else if (toolName === 'wait') {
    await page.waitForTimeout(Math.min(10000, params.time as number * 1000));
  } else if (toolName === 'click') {
    code.push(`await page.${await locator._generateLocatorString()}.click()`);
    await locator.click();
  } else if (toolName === 'enterText') {
    code.push(`await page.${await locator._generateLocatorString()}.click()`);
    await locator.click();
    code.push(`await page.${await locator._generateLocatorString()}.fill(${JSON.stringify(params.text)})`);
    await locator.fill(params.text as string);
    if (params.submit) {
      code.push(`await page.${await locator._generateLocatorString()}.press("Enter")`);
      await locator.press('Enter');
    }
  }
}

function elementLocator(page: playwright.Page, params: any): LocatorEx {
  return page.locator(`internal:aria-id=${params.elementId}`) as LocatorEx;
}
