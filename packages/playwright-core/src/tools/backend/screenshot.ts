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

import jpegjs from 'jpeg-js';
import { PNG } from 'pngjs';
import * as z from 'zod';
import { formatObject } from '@isomorphic/stringUtils';

import { scaleImageToSize } from '@isomorphic/imageUtils';
import { defineTabTool } from './tool';
import { optionalElementSchema } from './snapshot';

import type * as playwright from '../../..';

type ImageFormat = 'png' | 'jpeg' | 'webp';

const screenshotSchema = optionalElementSchema.extend({
  type: z.enum(['png', 'jpeg', 'webp']).optional().describe('Image format for the screenshot. If unset, inferred from the filename extension, otherwise png.'),
  filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg|webp}` if not specified. Prefer relative file names to stay within the output directory.'),
  fullPage: z.boolean().optional().describe('When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.'),
  scale: z.enum(['css', 'device']).default('css').describe('Image resolution scale. "css" produces a screenshot sized in CSS pixels (smaller, consistent across devices). "device" produces a high-resolution screenshot using device pixels (larger, accounts for the device pixel ratio). Default is css.'),
});

function inferTypeFromFilename(filename: string | undefined): ImageFormat | undefined {
  if (!filename)
    return undefined;
  switch (path.extname(filename).toLowerCase()) {
    case '.png': return 'png';
    case '.jpg':
    case '.jpeg': return 'jpeg';
    case '.webp': return 'webp';
  }
  return undefined;
}

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
    if (params.fullPage && params.target)
      throw new Error('fullPage cannot be used with element screenshots.');

    const fileType: ImageFormat = params.type ?? inferTypeFromFilename(params.filename) ?? 'png';
    const options: playwright.PageScreenshotOptions = {
      type: fileType,
      quality: fileType === 'jpeg' ? 90 : undefined,
      scale: params.scale,
      ...tab.actionTimeoutOptions,
      ...(params.fullPage !== undefined && { fullPage: params.fullPage })
    };

    const screenshotTargetLabel = params.target ? params.element || 'element' : (params.fullPage ? 'full page' : 'viewport');
    const target = params.target ? await tab.targetLocator({ element: params.element, target: params.target }) : null;
    const data = target ? await target.locator.screenshot(options) : await tab.page.screenshot(options);

    const resolvedFile = await response.resolveClientFile({ prefix: target ? 'element' : 'page', ext: fileType, suggestedFilename: params.filename }, `Screenshot of ${screenshotTargetLabel}`);

    response.addCode(`// Screenshot ${screenshotTargetLabel} and save it as ${resolvedFile.relativeName}`);
    if (target)
      response.addCode(`await page.${target.resolved}.screenshot(${formatObject({ ...options, path: resolvedFile.relativeName })});`);
    else
      response.addCode(`await page.screenshot(${formatObject({ ...options, path: resolvedFile.relativeName })});`);

    await response.addFileResult(resolvedFile, data);
    if (!params.filename)
      await response.registerImageResult(data, fileType);
  }
});

export function scaleImageToFitMessage(buffer: Buffer, imageType: 'png' | 'jpeg' | 'webp'): Buffer {
  // https://docs.claude.com/en/docs/build-with-claude/vision#evaluate-image-size
  // Not more than 1.15 megapixel, linear size not more than 1568.

  // No Node-side webp decoder is bundled, so we can't scale webp screenshots.
  if (imageType === 'webp')
    return buffer;

  const image = imageType === 'png' ? PNG.sync.read(buffer) : jpegjs.decode(buffer, { maxMemoryUsageInMB: 512 });
  const pixels = image.width * image.height;

  const shrink = Math.min(1568 / image.width, 1568 / image.height, Math.sqrt(1.15 * 1024 * 1024 / pixels));
  if (shrink > 1)
    return buffer;

  const width = image.width * shrink | 0;
  const height = image.height * shrink | 0;
  const scaledImage = scaleImageToSize(image, { width, height });
  // eslint-disable-next-line no-restricted-syntax
  return imageType === 'png' ? PNG.sync.write(scaledImage as any) : jpegjs.encode(scaledImage, 80).data;
}

export default [
  screenshot,
];
