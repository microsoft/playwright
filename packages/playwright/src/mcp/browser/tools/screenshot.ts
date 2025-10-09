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

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import * as javascript from '../codegen';
import { dateAsFileName } from './utils';

import type * as playwright from 'playwright-core';

const screenshotSchema = z.object({
  type: z.enum(['png', 'jpeg']).default('png').describe('Image format for the screenshot. Default is png.'),
  filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'),
  fullPage: z.boolean().optional().describe('When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.'),
});

const screenshot = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_take_screenshot',
    title: 'Take a screenshot',
    description: `Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.`,
    inputSchema: screenshotSchema,
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    if (!!params.element !== !!params.ref)
      throw new Error('Both element and ref must be provided or neither.');
    if (params.fullPage && params.ref)
      throw new Error('fullPage cannot be used with element screenshots.');

    const fileType = params.type || 'png';
    const fileName = await tab.context.outputFile(params.filename ?? dateAsFileName(fileType), { origin: 'llm', reason: 'Saving screenshot' });
    const options: playwright.PageScreenshotOptions = {
      type: fileType,
      quality: fileType === 'png' ? undefined : 90,
      scale: 'css',
      path: fileName,
      ...(params.fullPage !== undefined && { fullPage: params.fullPage })
    };
    const isElementScreenshot = params.element && params.ref;

    const screenshotTarget = isElementScreenshot ? params.element : (params.fullPage ? 'full page' : 'viewport');
    response.addCode(`// Screenshot ${screenshotTarget} and save it as ${fileName}`);

    // Only get snapshot when element screenshot is needed
    const ref = params.ref ? await tab.refLocator({ element: params.element || '', ref: params.ref }) : null;

    if (ref)
      response.addCode(`await page.${ref.resolved}.screenshot(${javascript.formatObject(options)});`);
    else
      response.addCode(`await page.screenshot(${javascript.formatObject(options)});`);

    const buffer = ref ? await ref.locator.screenshot(options) : await tab.page.screenshot(options);
    response.addResult(`Took the ${screenshotTarget} screenshot and saved it as ${fileName}`);

    // https://github.com/microsoft/playwright-mcp/issues/817
    // Never return large images to LLM, saving them to the file system is enough.
    if (!params.fullPage) {
      response.addImage({
        contentType: fileType === 'png' ? 'image/png' : 'image/jpeg',
        data: buffer
      });
    }
  }
});

export default [
  screenshot,
];
