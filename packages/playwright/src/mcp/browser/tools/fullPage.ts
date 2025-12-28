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
import { convertHtmlToMarkdown } from './markdownConverter';

const fullPage = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_full_page',
    title: 'Get full page as markdown',
    description: 'Wait for the page to fully load, scroll to load all content, and return the complete page content as markdown',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const tab = context.currentTabOrDie();
    const page = tab.page;

    // Wait for initial page load
    await page.waitForLoadState('networkidle');

    // Scroll to bottom repeatedly to trigger lazy loading
    // This handles infinite scroll pages and lazy-loaded content
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    // Keep scrolling until height stops changing or max iterations
    let iterations = 0;
    const maxIterations = 20; // Prevent infinite loops

    while (previousHeight !== currentHeight && iterations < maxIterations) {
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      // Wait a bit for content to load
      await page.waitForTimeout(500);

      // Wait for network to be idle again
      await page.waitForLoadState('networkidle');

      // Check new height
      previousHeight = currentHeight;
      currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      iterations++;
    }

    // Get the complete HTML after scrolling
    const html = await page.content();

    // Convert to markdown
    const markdown = await convertHtmlToMarkdown(html);

    // Add markdown to response (no snapshot)
    response.addMarkdown(markdown);
    response.addCode(`// Wait for page to load\nawait page.waitForLoadState('networkidle');\n\n// Scroll to load all content\nlet previousHeight = 0;\nlet currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);\nwhile (previousHeight !== currentHeight) {\n  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));\n  await page.waitForTimeout(500);\n  await page.waitForLoadState('networkidle');\n  previousHeight = currentHeight;\n  currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);\n}\n\n// Get full HTML\nconst html = await page.content();`);
    response.addResult(`Page content converted to markdown (scrolled ${iterations} times)`);
  },
});

export default [
  fullPage,
];

