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

import { scaleImageToSize } from 'playwright-core/lib/utils';
import { jpegjs, PNG } from 'playwright-core/lib/utilsBundle';
import { formatObject } from 'playwright-core/lib/utils';

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTabTool } from './tool';
import { dateAsFileName } from './utils';

import type * as playwright from 'playwright-core';

const screenshotSchema = z.object({
  type: z.enum(['png', 'jpeg']).default('png').describe('Image format for the screenshot. Default is png.'),
  filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified. Prefer relative file names to stay within the output directory.'),
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
    if (params.fullPage && params.ref)
      throw new Error('fullPage cannot be used with element screenshots.');

    const fileType = params.type || 'png';
    const options: playwright.PageScreenshotOptions = {
      type: fileType,
      quality: fileType === 'png' ? undefined : 90,
      scale: 'css',
      ...(params.fullPage !== undefined && { fullPage: params.fullPage })
    };

    const screenshotTarget = params.ref ? params.element || 'element' : (params.fullPage ? 'full page' : 'viewport');
    const ref = params.ref ? await tab.refLocator({ element: params.element || '', ref: params.ref }) : null;

    const data = ref ? await ref.locator.screenshot(options) : await tab.page.screenshot(options);
    const suggestedFilename = params.filename || dateAsFileName(ref ? 'element' : 'page', fileType);

    response.addCode(`// Screenshot ${screenshotTarget} and save it as ${suggestedFilename}`);
    if (ref)
      response.addCode(`await page.${ref.resolved}.screenshot(${formatObject({ ...options, path: suggestedFilename })});`);
    else
      response.addCode(`await page.screenshot(${formatObject({ ...options, path: suggestedFilename })});`);

    const contentType = fileType === 'png' ? 'image/png' : 'image/jpeg';
    await response.addResult(`Screenshot of ${screenshotTarget}`, data, { prefix: ref ? 'element' : 'page', ext: fileType, suggestedFilename, contentType });
  }
});

export function scaleImageToFitMessage(buffer: Buffer, imageType: 'png' | 'jpeg'): Buffer {
  // https://docs.claude.com/en/docs/build-with-claude/vision#evaluate-image-size
  // Not more than 1.15 megapixel, linear size not more than 1568.

  const image = imageType === 'png' ? PNG.sync.read(buffer) : jpegjs.decode(buffer, { maxMemoryUsageInMB: 512 });
  const pixels = image.width * image.height;

  const shrink = Math.min(1568 / image.width, 1568 / image.height, Math.sqrt(1.15 * 1024 * 1024 / pixels));
  if (shrink > 1)
    return buffer;

  const width = image.width * shrink | 0;
  const height = image.height * shrink | 0;
  const scaledImage = scaleImageToSize(image, { width, height });
  return imageType === 'png' ? PNG.sync.write(scaledImage as any) : jpegjs.encode(scaledImage, 80).data;
}

export default [
  screenshot,
];
