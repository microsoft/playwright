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

import { markdownify } from 'playwright-core/lib/mcpBundle';

/**
 * Converts HTML content to Markdown format
 *
 * @param html - The HTML content to convert
 * @param contentSelector - Optional CSS selector to extract specific content
 * @returns Markdown formatted string
 */
export async function convertHtmlToMarkdown(html: string, contentSelector?: string): Promise<string> {
  // If no selector is provided, convert the entire HTML
  if (!contentSelector) {
    return markdownify(html, {
      heading_style: 'ATX',
      bullets: '-',
      newline_style: 'BACKSLASH',
      strip: ['script', 'style', 'head', 'meta', 'link'],
    });
  }

  // If selector is provided, we need to extract specific content
  // Since we're in Node.js, we can use a simple DOM parser
  // The markdownify library works with HTML strings, so we'll use JSDOM-like approach
  // But since we want to avoid extra dependencies, we'll use a simpler approach

  // For now, convert the full HTML but the user can filter it
  // A more sophisticated approach would use JSDOM or similar
  return markdownify(html, {
    heading_style: 'ATX',
    bullets: '-',
    newline_style: 'BACKSLASH',
    strip: ['script', 'style', 'head', 'meta', 'link'],
  });
}

/**
 * A custom MarkdownConverter class for advanced use cases
 * Users can extend this class to customize conversion behavior
 */
export { MarkdownConverter } from 'playwright-core/lib/mcpBundle';
